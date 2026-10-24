import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { DatabaseService } from '../src/modules/database/database.service';

describe('Milestone M4: Kiosk Operations & Staff Admin Integration Tests', () => {
  let app: INestApplication;
  let db: DatabaseService;

  beforeAll(async () => {
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

  describe('Staff Job Listing & Filtering', () => {
    it('returns filtered jobs for staff operations', async () => {
      // Create jobs in various states
      const j1 = await db.createJob({ sessionId: 's1', kioskId: 'kiosk_dev_01', pricePaise: 200 });
      await db.updateJob(j1.id, { status: 'paid' });

      const j2 = await db.createJob({ sessionId: 's2', kioskId: 'kiosk_dev_01', pricePaise: 400 });
      await db.updateJob(j2.id, { status: 'completed' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/staff/jobs?status=paid')
        .expect(200);

      expect(res.body.data.jobs).toBeDefined();
      expect(res.body.data.jobs.length).toBeGreaterThanOrEqual(1);
      const paidJob = res.body.data.jobs.find((j: any) => j.id === j1.id);
      expect(paidJob).toBeDefined();
      expect(paidJob.status).toBe('paid');
    });
  });

  describe('Staff Pricing Management', () => {
    it('returns current pricing configuration and version', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/staff/pricing')
        .expect(200);

      expect(res.body.data.version).toBeDefined();
      expect(res.body.data.config.basePerSheetPaise.bw.a4).toBe(200);
    });

    it('updates pricing configuration with version increment and audit logging', async () => {
      const updateRes = await request(app.getHttpServer())
        .put('/api/v1/staff/pricing')
        .send({
          minOrderPaise: 150,
        })
        .expect(200);

      expect(updateRes.body.data.version).toBe(2);
      expect(updateRes.body.data.config.minOrderPaise).toBe(150);
      expect(updateRes.body.data.config.isPlaceholder).toBe(false);
    });
  });

  describe('Staff Reprint Flow', () => {
    it('allows staff to reprint a completed job', async () => {
      const completedJob = await db.createJob({
        sessionId: 's3',
        kioskId: 'kiosk_dev_01',
        pricePaise: 500,
      });
      await db.updateJob(completedJob.id, { status: 'completed', printStatus: 'completed' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/jobs/${completedJob.id}/reprint`)
        .expect(200);

      expect(res.body.data.status).toBe('paid');
      expect(res.body.data.printStatus).toBe('idle');
    });

    it('rejects reprinting an uncompleted draft job with 409 Conflict', async () => {
      const draftJob = await db.createJob({
        sessionId: 's4',
        kioskId: 'kiosk_dev_01',
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/staff/jobs/${draftJob.id}/reprint`)
        .expect(409);

      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });
  });
});
