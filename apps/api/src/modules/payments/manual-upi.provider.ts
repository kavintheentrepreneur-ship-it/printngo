import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DbJob } from '../database/database.service';
import {
  CreateOrderResult,
  GeneratedUpiLinks,
  PaymentProvider,
  WebhookEventResult,
} from './payment-provider.interface';

@Injectable()
export class ManualUpiPaymentProvider implements PaymentProvider {
  readonly providerName = 'manual_upi' as const;

  constructor(private readonly config: ConfigService) {}

  async createOrder(job: DbJob, amountPaise: number): Promise<CreateOrderResult> {
    const upiId = this.config.get<string>('UPI_ID', 'printngo@okhdfcbank');
    const payeeName = this.config.get<string>('PAYEE_NAME', 'PrintNGo');
    const orderId = `manual_${crypto.randomBytes(8).toString('hex')}`;

    const amountRupees2dp = (amountPaise / 100).toFixed(2);
    const payeeEncoded = encodeURIComponent(payeeName);
    const link = `upi://pay?pa=${upiId}&pn=${payeeEncoded}&am=${amountRupees2dp}&cu=INR&tn=${job.referenceCode}&tr=${orderId}`;

    const upiLinks: GeneratedUpiLinks = {
      gpay: link,
      phonepe: link,
      generic: link,
    };

    return {
      provider: 'manual_upi',
      providerOrderId: orderId,
      amountPaise,
      upiLinks,
    };
  }

  verifyWebhookSignature(): boolean {
    return false; // Manual UPI does not use webhooks
  }

  parseWebhookEvent(): WebhookEventResult {
    throw new Error('Webhooks not supported for manual UPI mode.');
  }
}
