import { prisma } from '../config/prisma';
import { Channel } from '@prisma/client';

/**
 * Template Service
 * 
 * Handles template lookup and variable rendering.
 * Supports {{variable}} substitution in body and subject.
 */
export class TemplateService {
  /**
   * Find a template by name for a given tenant.
   */
  static async findByName(tenantId: string, name: string) {
    return prisma.template.findUnique({
      where: {
        tenantId_name: { tenantId, name },
      },
    });
  }

  /**
   * Render a template's body (and subject) with provided variables.
   * Replaces all {{variableName}} with the corresponding value.
   */
  static render(
    template: string,
    variables: Record<string, string> = {}
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * Create or update a template for a tenant.
   */
  static async upsert(
    tenantId: string,
    data: {
      name: string;
      channel: Channel;
      subject?: string;
      body: string;
    }
  ) {
    return prisma.template.upsert({
      where: {
        tenantId_name: { tenantId, name: data.name },
      },
      update: {
        channel: data.channel,
        subject: data.subject,
        body: data.body,
      },
      create: {
        tenantId,
        name: data.name,
        channel: data.channel,
        subject: data.subject,
        body: data.body,
      },
    });
  }
}
