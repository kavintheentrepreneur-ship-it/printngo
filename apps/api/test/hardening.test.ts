import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityHeadersMiddleware } from '../src/common/middleware/security-headers.middleware';
import { RateLimiterMiddleware } from '../src/common/middleware/rate-limiter.middleware';
import { FilePurgeService } from '../src/modules/files/file-purge.service';
import { DatabaseService } from '../src/modules/database/database.service';
import { StaffService } from '../src/modules/staff/staff.service';
import { KioskGateway } from '../src/modules/realtime/kiosk.gateway';

describe('Milestone M6 - Hardening, Security, and File Purge', () => {
  let db: DatabaseService;
  let staffService: StaffService;
  let gateway: KioskGateway;

  beforeEach(() => {
    db = new DatabaseService();
    gateway = new KioskGateway(db);
    staffService = new StaffService(db, gateway);
  });

  describe('SecurityHeadersMiddleware', () => {
    it('should set defensive security headers on all responses', () => {
      const middleware = new SecurityHeadersMiddleware();
      const headers: Record<string, string> = {};

      const req = {} as any;
      const res = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
      } as any;
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      middleware.use(req, res, next);

      expect(nextCalled).toBe(true);
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
      expect(headers['Content-Security-Policy']).toBeDefined();
    });
  });

  describe('RateLimiterMiddleware', () => {
    it('should allow requests within rate limit and reject when limit is exceeded', () => {
      const middleware = new RateLimiterMiddleware();

      const makeRequest = (token?: string, kioskId?: string, path = '/api/v1/jobs') => {
        let statusCode = 200;
        let responseJson: any = null;
        let nextCalled = false;

        const req = {
          headers: {
            ...(token ? { 'x-session-token': token } : {}),
            ...(kioskId ? { 'x-kiosk-id': kioskId } : {}),
          },
          path,
          socket: { remoteAddress: '127.0.0.1' },
        } as any;

        const res = {
          status: (code: number) => {
            statusCode = code;
            return {
              json: (data: any) => {
                responseJson = data;
              },
            };
          },
        } as any;

        const next = () => {
          nextCalled = true;
        };

        middleware.use(req, res, next);
        return { statusCode, responseJson, nextCalled };
      };

      // 60 requests should pass for a session token
      for (let i = 0; i < 60; i++) {
        const res = makeRequest('token_test_abc');
        expect(res.nextCalled).toBe(true);
        expect(res.statusCode).toBe(200);
      }

      // 61st request should be rejected with 429
      const rejected = makeRequest('token_test_abc');
      expect(rejected.nextCalled).toBe(false);
      expect(rejected.statusCode).toBe(429);
      expect(rejected.responseJson.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('FilePurgeService', () => {
    const testDir = path.resolve(process.cwd(), 'uploads');

    afterEach(() => {
      // Cleanup any test files created in uploads directory
      try {
        if (fs.existsSync(testDir)) {
          const files = fs.readdirSync(testDir);
          for (const file of files) {
            if (file.startsWith('test_purge_')) {
              fs.unlinkSync(path.join(testDir, file));
            }
          }
        }
      } catch {}
    });

    it('should purge files older than 7 days and record event logs', async () => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      const oldFile = path.join(testDir, 'test_purge_old.pdf');
      const freshFile = path.join(testDir, 'test_purge_fresh.pdf');

      fs.writeFileSync(oldFile, 'old content');
      fs.writeFileSync(freshFile, 'fresh content');

      // Set old file modified time to 8 days ago
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldFile, eightDaysAgo, eightDaysAgo);

      const purgeService = new FilePurgeService(db);
      const result = await purgeService.purgeExpiredFiles(7);

      expect(result.purgedCount).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(freshFile)).toBe(true);

      const logs = await db.getRecentLogs(10);
      const purgeLog = logs.find((l) => l.eventType === 'customer_file_purged');
      expect(purgeLog).toBeDefined();
    });
  });

  describe('Staff Refund & Event Log Audit Trail', () => {
    it('should allow staff to refund a failed or cancelled job', async () => {
      const job = await db.createJob({
        sessionId: 'session_test_refund',
        kioskId: 'kiosk_dev_01',
        pricePaise: 400,
      });

      // Move job to paid, then simulate print failure
      await db.updateJob(job.id, {
        status: 'failed',
        pricePaise: 400,
        paymentStatus: 'captured',
      });

      const refundedJob = await staffService.refundJob(job.id, 'operator@printngo.com');

      expect(refundedJob.status).toBe('refunded');
      expect(refundedJob.paymentStatus).toBe('refunded');

      const logs = await staffService.getEventLogs(10);
      const refundLog = logs.find((l) => l.eventType === 'staff_job_refunded');
      expect(refundLog).toBeDefined();
      const payload = refundLog?.payload as Record<string, any> | undefined;
      expect(payload?.staffUser).toBe('operator@printngo.com');
      expect(payload?.amountPaise).toBe(400);
    });

    it('should reject refunding jobs in draft status', async () => {
      const job = await db.createJob({
        sessionId: 'session_test_draft',
        kioskId: 'kiosk_dev_01',
        pricePaise: 200,
      });

      await expect(staffService.refundJob(job.id)).rejects.toThrow();
    });
  });
});
