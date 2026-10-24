import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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
export class RazorpayPaymentProvider implements PaymentProvider {
  readonly providerName = 'razorpay' as const;
  private readonly logger = new Logger(RazorpayPaymentProvider.name);

  constructor(
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  generateUpiLink(
    upiId: string,
    payeeName: string,
    amountPaise: number,
    jobReferenceCode: string,
    orderId: string,
  ): string {
    const amountRupees2dp = (amountPaise / 100).toFixed(2);
    const payeeEncoded = encodeURIComponent(payeeName);
    return `upi://pay?pa=${upiId}&pn=${payeeEncoded}&am=${amountRupees2dp}&cu=INR&tn=${jobReferenceCode}&tr=${orderId}`;
  }

  async createOrder(job: DbJob, amountPaise: number): Promise<CreateOrderResult> {
    const upiId =
      this.config?.get<string>('UPI_ID') ||
      process.env.UPI_ID ||
      'printngo@okhdfcbank';
    const payeeName =
      this.config?.get<string>('PAYEE_NAME') ||
      process.env.PAYEE_NAME ||
      'PrintNGo';

    // Generate Razorpay format order ID (e.g. order_XXXXX)
    const providerOrderId = `order_${crypto.randomBytes(10).toString('hex')}`;

    const link = this.generateUpiLink(
      upiId,
      payeeName,
      amountPaise,
      job.referenceCode,
      providerOrderId,
    );

    const upiLinks: GeneratedUpiLinks = {
      gpay: link,
      phonepe: link,
      generic: link,
    };

    return {
      provider: 'razorpay',
      providerOrderId,
      amountPaise,
      upiLinks,
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    const webhookSecret =
      this.config?.get<string>('RAZORPAY_WEBHOOK_SECRET') ||
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      'razorpay_mock_webhook_secret_for_testing';

    if (!signature) return false;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  parseWebhookEvent(body: any): WebhookEventResult {
    const eventId = body?.id || `evt_${crypto.randomBytes(8).toString('hex')}`;
    const eventType = body?.event || 'payment.captured';
    const paymentEntity = body?.payload?.payment?.entity || body;

    const orderId = paymentEntity?.order_id || paymentEntity?.notes?.order_id || '';
    const amountPaise = paymentEntity?.amount || 0;

    let status: 'captured' | 'failed' | 'refunded' = 'captured';
    if (eventType === 'payment.failed') status = 'failed';
    else if (eventType === 'refund.processed') status = 'refunded';

    return {
      eventId,
      eventType,
      orderId,
      amountPaise,
      status,
      rawEvent: body,
    };
  }
}
