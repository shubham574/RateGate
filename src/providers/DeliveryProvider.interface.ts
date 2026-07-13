import { DeliveryResult } from '../types';

/**
 * DeliveryProvider Interface
 * 
 * All notification providers (email, SMS, push, etc.) implement this interface.
 * This is the adapter pattern — swap providers without changing business logic.
 */
export interface DeliveryProvider {
  /**
   * Send a notification to the recipient.
   * Returns success/failure with optional provider message ID.
   */
  send(payload: {
    to: string;
    subject?: string | null;
    body: string;
  }): Promise<DeliveryResult>;
}
