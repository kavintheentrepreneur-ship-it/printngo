import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertJobTransition } from '@printngo/shared';
import { DatabaseService, DbJob } from '../database/database.service';
import { KioskGateway } from '../realtime/kiosk.gateway';
import { ManualUpiPaymentProvider } from './manual-upi.provider';
import { PaymentProvider } from './payment-provider.interface';
import { RazorpayPaymentProvider } from './razorpay.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly processedEvents = new Set<string>();

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
    @Optional() @Inject(KioskGateway) private readonly kioskGateway?: KioskGateway,
    @Inject(RazorpayPaymentProvider)
    private readonly razorpayProvider?: RazorpayPaymentProvider,
    @Inject(ManualUpiPaymentProvider)
    private readonly manualProvider?: ManualUpiPaymentProvider,
  ) {}

  private getActiveProvider(): PaymentProvider {
    const providerType =
      this.config?.get<string>('PAYMENT_PROVIDER') ||
      process.env.PAYMENT_PROVIDER ||
      'razorpay';

    if (providerType === 'manual_upi' && this.manualProvider) {
      return this.manualProvider;
    }
    if (this.razorpayProvider) {
      return this.razorpayProvider;
    }
    throw new Error('No payment provider configured');
  }

  async getPaymentLinks(jobId: string) {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (job.status !== 'draft' && job.status !== 'awaiting_payment') {
      throw new HttpException(
        {
          code: 'INVALID_STATE_TRANSITION',
          message: `Cannot generate payment links for job with status ${job.status}`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const provider = this.getActiveProvider();
    const order = await provider.createOrder(job, job.pricePaise);

    // Record payment order
    await this.db.createPayment({
      jobId: job.id,
      provider: order.provider,
      providerOrderId: order.providerOrderId,
      amountPaise: order.amountPaise,
      status: 'created',
      method: 'upi_intent',
    });

    const upiId =
      this.config?.get<string>('UPI_ID') ||
      process.env.UPI_ID ||
      'printngo@okhdfcbank';
    const payeeName =
      this.config?.get<string>('PAYEE_NAME') ||
      process.env.PAYEE_NAME ||
      'PrintNGo';

    const amountRupeesFormatted = `₹${(job.pricePaise / 100).toFixed(2)}`;

    return {
      jobId: job.id,
      referenceCode: job.referenceCode,
      amountPaise: job.pricePaise,
      amountRupeesFormatted,
      upiId,
      payeeName,
      upiLinks: order.upiLinks,
      provider: order.provider,
      providerOrderId: order.providerOrderId,
    };
  }

  async getPaymentStatus(jobId: string) {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      jobId: job.id,
      referenceCode: job.referenceCode,
      status: job.status,
      paymentStatus: job.paymentStatus,
      isPaid: job.status === 'paid' || job.status === 'queued' || job.status === 'printing' || job.status === 'completed',
    };
  }

  async handleRazorpayWebhook(rawBody: string | Buffer, signature: string) {
    const provider = this.razorpayProvider || this.getActiveProvider();

    const isValid = provider.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn('Rejected Razorpay webhook: invalid signature');
      throw new HttpException(
        {
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Webhook signature verification failed.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bodyObj = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
    const parsed = provider.parseWebhookEvent(bodyObj);

    // Idempotency check: process each event id once
    if (this.processedEvents.has(parsed.eventId)) {
      this.logger.log(`Ignoring duplicate webhook event ${parsed.eventId}`);
      return { status: 'already_processed', eventId: parsed.eventId };
    }
    this.processedEvents.add(parsed.eventId);

    const payment = await this.db.findPaymentByOrderId(parsed.orderId);
    let job: DbJob | null = null;
    if (payment) {
      job = await this.db.findJobById(payment.jobId);
    } else {
      // Fallback search by reference code in notes
      const refCode = bodyObj?.payload?.payment?.entity?.notes?.job_reference_code || bodyObj?.notes?.job_reference_code;
      if (refCode) {
        job = await this.db.findJobByReferenceCode(refCode);
      }
    }

    if (!job) {
      this.logger.warn(`Webhook received for unknown order ${parsed.orderId}`);
      return { status: 'order_not_found', orderId: parsed.orderId };
    }

    // Check amount match
    if (parsed.amountPaise > 0 && parsed.amountPaise !== job.pricePaise) {
      this.logger.error(
        `PAYMENT MISMATCH for job ${job.referenceCode}: expected ${job.pricePaise} paise, received ${parsed.amountPaise} paise`,
      );
      await this.db.logEvent(
        'payment_amount_mismatch',
        { expected: job.pricePaise, received: parsed.amountPaise, orderId: parsed.orderId },
        job.id,
        job.kioskId,
      );
      throw new HttpException(
        {
          code: 'PAYMENT_AMOUNT_MISMATCH',
          message: 'Payment amount does not match locked job price.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (parsed.eventType === 'payment.captured' || parsed.status === 'captured') {
      try {
        assertJobTransition(job.status, 'paid');
      } catch (e) {
        // If already paid or queued, acknowledge idempotent success
        if (job.status === 'paid' || job.status === 'queued') {
          return { status: 'success', jobStatus: job.status };
        }
        throw e;
      }

      await this.db.updateJob(job.id, {
        status: 'paid',
        paymentStatus: 'captured',
      });

      if (payment) {
        await this.db.updatePayment(payment.id, {
          status: 'captured',
          rawEvent: parsed.rawEvent,
        });
      }

      await this.db.logEvent('payment_captured', { eventId: parsed.eventId, orderId: parsed.orderId }, job.id, job.kioskId);
      this.kioskGateway?.emitJobPaid(job.kioskId, { ...job, status: 'paid' });
      this.logger.log(`Job ${job.referenceCode} successfully marked as PAID`);
    }

    return { status: 'success', eventId: parsed.eventId };
  }

  async confirmPaymentByStaff(
    jobId: string,
    staffEmail: string,
    confirmedAmountPaise: number,
  ) {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (confirmedAmountPaise !== job.pricePaise) {
      throw new HttpException(
        {
          code: 'AMOUNT_MISMATCH',
          message: `Confirmed amount ₹${(confirmedAmountPaise / 100).toFixed(2)} does not match job price ₹${(job.pricePaise / 100).toFixed(2)}`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    assertJobTransition(job.status, 'paid');

    const updatedJob = await this.db.updateJob(job.id, {
      status: 'paid',
      paymentStatus: 'captured',
    });

    await this.db.logEvent(
      'staff_manual_payment_confirmed',
      { staffEmail, amountPaise: confirmedAmountPaise },
      job.id,
      job.kioskId,
    );

    this.kioskGateway?.emitJobPaid(job.kioskId, updatedJob);

    return { success: true, job: updatedJob };
  }
}
