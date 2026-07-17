import { prisma } from '../config/prisma';
import { Channel, NotificationStatus } from '@prisma/client';
import { TemplateService } from './template.service';
import { smsQueue, emailQueue } from '../queues/notification.queue';
import { NotificationJobPayload } from '../types';

/**
 * Notification Service
 * 
 * Handles notification creation, template resolution, and queueing.
 */
export class NotificationService {
  /**
   * Create and enqueue a notification.
   * Returns the created notification record.
   */
  static async createAndEnqueue(params: {
    tenantId: string;
    channel: Channel;
    recipient: string;
    templateName?: string;
    subject?: string;
    body?: string;
    variables?: Record<string, string>;
    idempotencyKey?: string;
  }) {
    const {
      tenantId,
      channel,
      recipient,
      templateName,
      subject,
      body,
      variables = {},
      idempotencyKey,
    } = params;

    // Resolve template OR raw body
    let renderedSubject: string | null = subject || null;
    let renderedBody: string;
    let templateId: string | undefined;

    if (templateName) {
      const template = await TemplateService.findByName(tenantId, templateName);
      if (!template) {
        throw Object.assign(new Error(`Template '${templateName}' not found`), {
          statusCode: 404,
        });
      }
      if (template.channel !== channel) {
        throw Object.assign(
          new Error(
            `Template '${templateName}' is for ${template.channel}, not ${channel}`
          ),
          { statusCode: 400 }
        );
      }
      templateId = template.id;
      renderedBody = TemplateService.render(template.body, variables);
      renderedSubject = template.subject
        ? TemplateService.render(template.subject, variables)
        : null;
    } else if (body) {
      renderedBody = TemplateService.render(body, variables);
      if (subject) {
        renderedSubject = TemplateService.render(subject, variables);
      }
    } else {
      throw Object.assign(
        new Error('Either templateName or body must be provided'),
        { statusCode: 400 }
      );
    }

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        tenantId,
        templateId,
        channel,
        recipient,
        status: NotificationStatus.QUEUED,
        idempotencyKey,
      },
    });

    // Enqueue the job to BullMQ
    const payload: NotificationJobPayload = {
      notificationId: notification.id,
      tenantId,
      channel,
      recipient,
      renderedSubject,
      renderedBody,
      idempotencyKey,
    };

    const targetQueue = channel === 'SMS' ? smsQueue : emailQueue;
    await targetQueue.add(`notify-${channel.toLowerCase()}`, payload, {
      jobId: notification.id, // Use notification ID as job ID for deduplication
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    console.log(
      `[Notification] Queued ${channel} to ${recipient} (id: ${notification.id})`
    );

    return notification;
  }

  /**
   * Get a notification by ID, scoped to the tenant.
   */
  static async getById(tenantId: string, id: string) {
    return prisma.notification.findFirst({
      where: { id, tenantId },
    });
  }

  /**
   * Check for an existing notification with the same idempotency key.
   */
  static async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string
  ) {
    return prisma.notification.findUnique({
      where: {
        tenantId_idempotencyKey: { tenantId, idempotencyKey },
      },
    });
  }
}
