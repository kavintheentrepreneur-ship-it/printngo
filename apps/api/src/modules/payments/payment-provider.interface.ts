import { PaymentStatus } from '@printngo/shared';
import { DbJob } from '../database/database.service';

export interface GeneratedUpiLinks {
  gpay: string;
  phonepe: string;
  generic: string;
}

export interface CreateOrderResult {
  provider: 'razorpay' | 'manual_upi';
  providerOrderId: string;
  amountPaise: number;
  upiLinks: GeneratedUpiLinks;
}

export interface WebhookEventResult {
  eventId: string;
  eventType: string;
  orderId: string;
  amountPaise: number;
  status: PaymentStatus;
  rawEvent: unknown;
}

export interface PaymentProvider {
  readonly providerName: 'razorpay' | 'manual_upi';

  createOrder(job: DbJob, amountPaise: number): Promise<CreateOrderResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean;

  parseWebhookEvent(body: any): WebhookEventResult;
}
