import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { DatabaseService } from '../src/modules/database/database.service';

describe('Milestone M3: Payments & Webhook Integration Tests', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let sessionToken: string;
  let jobId: string;
  let referenceCode: string;

  const KIOSK_ID = 'kiosk_dev_01';
  const KIOSK_SECRET = 'kiosk_super_secret_hmac_key_32_chars';
  const WEBHOOK_SECRET = 'razorpay_mock_webhook_secret_for_testing';

  beforeAll(async () => {
    process.env.DEFAULT_KIOSK_ID = KIOSK_ID;
    process.env.DEFAULT_KIOSK_SECRET = KIOSK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.UPI_ID = 'printngo@okhdfcbank';
    process.env.PAYEE_NAME = 'PrintNGo';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    db = moduleRef.get<DatabaseService>(DatabaseService);

    // Create session via kiosk API
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/api/v1/kiosk/sessions';
    const payload = `POST:${path}:${timestamp}:`;
    const signature = crypto.createHmac('sha256', KIOSK_SECRET).update(payload).digest('hex');

    const res = await request(app.getHttpServer())
      .post(path)
      .set({
        'x-kiosk-id': KIOSK_ID,
        'x-kiosk-timestamp': timestamp.toString(),
        'x-kiosk-signature': signature,
      });

    sessionToken = res.body.data.token;
    jobId = res.body.data.jobId;
    referenceCode = res.body.data.jobReferenceCode;

    // Attach mock file and move job to awaiting_payment
    await db.createFile({
      jobId,
      storageKey: 'test_key.pdf',
      originalName: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      pageCount: 2,
      sha256: 'mock_sha256',
    });
    await db.updateJob(jobId, { status: 'awaiting_payment', pricePaise: 400 });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('UPI Payment Links Generation', () => {
    it('generates per-job GPay and PhonePe deep links with correct parameters', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/payment-links`)
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.upiLinks).toBeDefined();
      expect(res.body.data.upiLinks.gpay).toContain('upi://pay?');
      expect(res.body.data.upiLinks.gpay).toContain('pa=printngo@okhdfcbank');
      expect(res.body.data.upiLinks.gpay).toContain('am=4.00');
      expect(res.body.data.upiLinks.gpay).toContain(`tn=${referenceCode}`);
      expect(res.body.data.upiLinks.phonepe).toBe(res.body.data.upiLinks.gpay);
    });

    it('returns pending payment status before payment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}/payment-status`)
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(false);
      expect(res.body.data.status).toBe('awaiting_payment');
    });
  });

  describe('Razorpay Webhook Handling & Idempotency', () => {
    it('rejects webhook with invalid signature with 400 Bad Request', async () => {
      const body = { id: 'evt_test_1', event: 'payment.captured' };
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', 'invalid_hex_signature')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
    });

    it('processes verified payment.captured webhook, marks job paid, and updates status', async () => {
      // Fetch current payment order ID
      const paymentLinksRes = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/payment-links`)
        .set('x-session-token', sessionToken);
      const orderId = paymentLinksRes.body.data.providerOrderId;

      const eventPayload = {
        id: 'evt_success_123',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_999',
              order_id: orderId,
              amount: 400,
              status: 'captured',
            },
          },
        },
      };

      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('success');

      // Verify job is now paid
      const statusRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}/payment-status`)
        .set('x-session-token', sessionToken);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe('paid');
      expect(statusRes.body.data.paymentStatus).toBe('captured');
      expect(statusRes.body.data.isPaid).toBe(true);
    });

    it('ignores duplicate webhook events idempotently', async () => {
      const eventPayload = {
        id: 'evt_success_123', // Same event ID as previous test
        event: 'payment.captured',
      };
      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks/razorpay')
        .set('x-razorpay-signature', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('already_processed');
    });
  });

  describe('Staff Manual UPI Payment Confirmation', () => {
    it('allows authenticated staff to confirm payment when amount matches exactly', async () => {
      // Create second job
      const job2 = await db.createJob({
        sessionId: 'session_mock',
        kioskId: KIOSK_ID,
        pricePaise: 600,
      });
      await db.updateJob(job2.id, { status: 'awaiting_payment' });

      // Amount mismatch check
      const failRes = await request(app.getHttpServer())
        .post(`/api/v1/staff/payments/${job2.id}/confirm`)
        .send({ amountPaise: 500, staffEmail: 'admin@printngo.com' });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.code).toBe('AMOUNT_MISMATCH');

      // Exact amount confirmation
      const successRes = await request(app.getHttpServer())
        .post(`/api/v1/staff/payments/${job2.id}/confirm`)
        .send({ amountPaise: 600, staffEmail: 'admin@printngo.com' });

      expect(successRes.status).toBe(200);
      expect(successRes.body.data.success).toBe(true);
      expect(successRes.body.data.job.status).toBe('paid');
    });
  });
});
