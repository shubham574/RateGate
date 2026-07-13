import { Resend } from 'resend';
import { env } from '../config/env';
import { DeliveryProvider } from './DeliveryProvider.interface';
import { DeliveryResult } from '../types';

/**
 * Resend Email Provider
 * 
 * Implements the DeliveryProvider interface using the Resend SDK.
 */
export class ResendProvider implements DeliveryProvider {
  private client: Resend;

  constructor() {
    this.client = new Resend(env.RESEND_API_KEY);
  }

  async send(payload: {
    to: string;
    subject?: string | null;
    body: string;
  }): Promise<DeliveryResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: 'RateGate <onboarding@resend.dev>',
        to: [payload.to],
        subject: payload.subject || 'Notification',
        html: payload.body,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        providerMsgId: data?.id,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown Resend error',
      };
    }
  }
}
