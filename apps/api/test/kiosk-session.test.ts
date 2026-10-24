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

describe('Milestone M1: Kiosk Session & QR API Integration Tests', () => {
  let app: INestApplication;
  let db: DatabaseService;

  const KIOSK_ID = 'kiosk_dev_01';
  const KIOSK_SECRET = 'kiosk_super_secret_hmac_key_32_chars';

  beforeAll(async () => {
    process.env.DEFAULT_KIOSK_ID = KIOSK_ID;
    process.env.DEFAULT_KIOSK_SECRET = KIOSK_SECRET;
    process.env.CUSTOMER_APP_URL = 'http://localhost:3000';

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
  });

  afterAll(async () => {
    await app.close();
  });

  function createHmacHeaders(method: string, path: string, body?: unknown, timestampDelta = 0) {
    const timestamp = Math.floor(Date.now() / 1000) + timestampDelta;
    const bodyStr = body ? JSON.stringify(body) : '';
    const payload = `${method.toUpperCase()}:${path}:${timestamp}:${bodyStr}`;
    const signature = crypto
      .createHmac('sha256', KIOSK_SECRET)
      .update(payload)
      .digest('hex');

    return {
      'x-kiosk-id': KIOSK_ID,
      'x-kiosk-timestamp': timestamp.toString(),
      'x-kiosk-signature': signature,
    };
  }

  describe('Kiosk Authentication & Session Creation', () => {
    it('creates a new session and returns QR URL with valid HMAC signature', async () => {
      const path = '/api/v1/kiosk/sessions';
      const headers = createHmacHeaders('POST', path);

      const res = await request(app.getHttpServer())
        .post(path)
        .set(headers);

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.qrUrl).toContain(`http://localhost:3000/s/${res.body.data.token}`);
      expect(res.body.data.jobReferenceCode).toBeDefined();
      expect(res.body.data.jobReferenceCode.length).toBe(6);
    });

    it('rejects kiosk request missing required headers', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/kiosk/sessions')
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED_KIOSK');
    });

    it('rejects kiosk request with invalid HMAC signature', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/kiosk/sessions')
        .set({
          'x-kiosk-id': KIOSK_ID,
          'x-kiosk-timestamp': Math.floor(Date.now() / 1000).toString(),
          'x-kiosk-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('rejects kiosk request with expired timestamp (replay attack)', async () => {
      const path = '/api/v1/kiosk/sessions';
      // 6 minutes in the past
      const headers = createHmacHeaders('POST', path, undefined, -360);

      const res = await request(app.getHttpServer())
        .post(path)
        .set(headers);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REPLAY_ATTACK_DETECTED');
    });
  });

  describe('Customer Session Validation & Lifecycle', () => {
    it('allows a customer to resume a draft job using the session token', async () => {
      // 1. Kiosk creates session
      const createHeaders = createHmacHeaders('POST', '/api/v1/kiosk/sessions');
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/kiosk/sessions')
        .set(createHeaders);

      const token = createRes.body.data.token;

      // 2. Customer opens /sessions/:token
      const sessionRes = await request(app.getHttpServer()).get(`/api/v1/sessions/${token}`);

      expect(sessionRes.status).toBe(200);
      expect(sessionRes.body.data.session.status).toBe('open');
      expect(sessionRes.body.data.job.referenceCode).toBe(createRes.body.data.jobReferenceCode);
      expect(sessionRes.body.data.job.type).toBe('paper');
      expect(sessionRes.body.data.job.size).toBe('a4');
    });

    it('returns 410 Gone with friendly message when session is expired', async () => {
      // Create session manually expired in the past
      const rawToken = 'expired_test_token_1234567890';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiredDate = new Date(Date.now() - 10000);

      await db.createSession(KIOSK_ID, rawToken, tokenHash, expiredDate);

      const res = await request(app.getHttpServer()).get(`/api/v1/sessions/${rawToken}`);

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
      expect(res.body.error.message).toBe(
        'This kiosk session has ended. Please scan the new QR code on the screen.',
      );
    });

    it('returns 404 Not Found for non-existent token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/sessions/invalid_random_token_999');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });
});
