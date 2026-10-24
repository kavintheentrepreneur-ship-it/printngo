import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { DatabaseService } from '../src/modules/database/database.service';

describe('Milestone M2: Customer Flow API Integration Tests', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let sessionToken: string;
  let jobId: string;

  const KIOSK_ID = 'kiosk_dev_01';
  const KIOSK_SECRET = 'kiosk_super_secret_hmac_key_32_chars';

  beforeAll(async () => {
    process.env.DEFAULT_KIOSK_ID = KIOSK_ID;
    process.env.DEFAULT_KIOSK_SECRET = KIOSK_SECRET;

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function createSamplePdf(pageCount: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      doc.addPage([595.28, 841.89]); // A4 dimensions
    }
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  describe('File Upload & Validation', () => {
    it('uploads a valid multi-page PDF and detects page count accurately', async () => {
      const pdfBuffer = await createSamplePdf(3);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionToken}/files`)
        .set('x-session-token', sessionToken)
        .attach('file', pdfBuffer, 'sample_3pages.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.file.originalName).toBe('sample_3pages.pdf');
      expect(res.body.data.file.pageCount).toBe(3);
      expect(res.body.data.file.mimeType).toBe('application/pdf');

      // Draft job should have updated page count and price
      expect(res.body.data.job.pageCount).toBe(3);
      // 3 pages A4 B&W single side = 3 * 200 = 600 paise
      expect(res.body.data.priceBreakdown.totalPaise).toBe(600);
      expect(res.body.data.priceBreakdown.totalRupeesFormatted).toBe('₹6.00');
    });

    it('rejects an executable disguised as a PDF with 415 Unsupported Media Type', async () => {
      // Fake EXE file header (MZ: 0x4D, 0x5A)
      const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionToken}/files`)
        .set('x-session-token', sessionToken)
        .attach('file', fakeExe, 'virus.pdf');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
      expect(res.body.error.message).toContain('Executable files are prohibited');
    });

    it('rejects a file exceeding 25 MB with 413 Payload Too Large', async () => {
      // Create buffer exceeding 25MB (25MB + 1024 bytes)
      const largeBuffer = Buffer.alloc(25 * 1024 * 1024 + 1024, 0x20);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionToken}/files`)
        .set('x-session-token', sessionToken)
        .attach('file', largeBuffer, 'huge_file.pdf');

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
      expect(res.body.error.message).toBe('This file is larger than 25 MB. Please upload a smaller file.');
    });
  });

  describe('Option Saving & Price Recalculation', () => {
    it('updates options and live recalculates price breakdown', async () => {
      // Update options: color: 'color', size: 'a4', sides: 'duplex', pagesPerSheet: 1, copies: 2
      const res = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/options`)
        .set('x-session-token', sessionToken)
        .send({
          color: 'color',
          size: 'a4',
          sides: 'duplex',
          pagesPerSheet: 1,
          copies: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.job.color).toBe('color');
      expect(res.body.data.job.sides).toBe('duplex');
      expect(res.body.data.job.copies).toBe(2);

      // Current job has 3 pages
      // Duplex: ceil(3 / 2) = 2 sheets
      // Color A4 base rate: 1000 paise
      // Subtotal per copy: 2 * 1000 = 2000 paise
      // 2 copies: 4000 paise = ₹40.00
      expect(res.body.data.priceBreakdown.billableSheets).toBe(2);
      expect(res.body.data.priceBreakdown.totalPaise).toBe(4000);
      expect(res.body.data.priceBreakdown.totalRupeesFormatted).toBe('₹40.00');
    });

    it('validates custom page range and rejects out of bounds with 422', async () => {
      // Current doc has 3 pages. Requesting page 5 should fail with 422
      const res = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/options`)
        .set('x-session-token', sessionToken)
        .send({
          pageRange: '1, 5',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_PAGE_RANGE');
      expect(res.body.error.message).toContain('The file has 3 pages, but page 5 was requested');
    });

    it('accepts valid page range and adjusts effective pages', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/options`)
        .set('x-session-token', sessionToken)
        .send({
          pageRange: '1-2',
          copies: 1,
          color: 'bw',
          sides: 'single',
          pagesPerSheet: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.job.pageRange).toBe('1-2');
      // 2 pages * 200 = 400 paise
      expect(res.body.data.priceBreakdown.billableSheets).toBe(2);
      expect(res.body.data.priceBreakdown.totalPaise).toBe(400);
      expect(res.body.data.priceBreakdown.totalRupeesFormatted).toBe('₹4.00');
    });

    it('allows live price querying via GET /jobs/:id/price', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}/price`)
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.data.priceBreakdown.totalPaise).toBe(400);
    });
  });

  describe('Order Finalization / Proceed', () => {
    it('locks price and moves status to awaiting_payment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/proceed`)
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.data.job.status).toBe('awaiting_payment');
      expect(res.body.data.job.pricePaise).toBe(400);
    });

    it('is idempotent when calling proceed multiple times', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/proceed`)
        .set('x-session-token', sessionToken);

      expect(res.status).toBe(200);
      expect(res.body.data.job.status).toBe('awaiting_payment');
      expect(res.body.data.job.pricePaise).toBe(400);
    });

    it('rejects option modifications once job is in awaiting_payment state with 409 Conflict', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/options`)
        .set('x-session-token', sessionToken)
        .send({ copies: 5 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
      expect(res.body.error.message).toBe('Options can only be edited while job is in draft state.');
    });
  });
});
