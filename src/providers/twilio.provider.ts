import twilio from 'twilio';
import { env } from '../config/env';
import { DeliveryProvider } from './DeliveryProvider.interface';
import { DeliveryResult } from '../types';

/**
 * Twilio SMS Provider
 * 
 * Implements the DeliveryProvider interface using the Twilio SDK.
 */
export class TwilioProvider implements DeliveryProvider {
  private client: ReturnType<typeof twilio>;

  constructor() {
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  async send(payload: {
    to: string;
    subject?: string | null;
    body: string;
  }): Promise<DeliveryResult> {
    try {
      const message = await this.client.messages.create({
        to: payload.to,
        from: env.TWILIO_FROM_NUMBER,
        body: payload.body,
      });

      return {
        success: true,
        providerMsgId: message.sid,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown Twilio error',
      };
    }
  }
}
