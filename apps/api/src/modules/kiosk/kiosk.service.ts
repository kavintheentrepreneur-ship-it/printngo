import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertJobTransition, JobStatus } from '@printngo/shared';
import * as crypto from 'crypto';
import { DatabaseService, DbJob, DbSession } from '../database/database.service';

export interface CreateSessionResult {
  sessionId: string;
  token: string;
  expiresAt: string;
  qrUrl: string;
  jobId: string;
  jobReferenceCode: string;
}

@Injectable()
export class KioskService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  async createSession(kioskId: string): Promise<CreateSessionResult> {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 15 minutes expiration rule
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const session = await this.db.createSession(kioskId, rawToken, tokenHash, expiresAt);

    // Create initial draft job for this session
    const job = await this.db.createJob({
      sessionId: session.id,
      kioskId,
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 1,
      copies: 1,
      pricePaise: 200,
      isPlaceholder: true,
    });

    const customerAppUrl =
      this.config?.get<string>('CUSTOMER_APP_URL') ||
      process.env.CUSTOMER_APP_URL ||
      'http://localhost:3000';
    const qrUrl = `${customerAppUrl}/s/${rawToken}`;

    await this.db.logEvent('session_created', { sessionId: session.id, jobId: job.id }, job.id, kioskId);

    return {
      sessionId: session.id,
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      qrUrl,
      jobId: job.id,
      jobReferenceCode: job.referenceCode,
    };
  }

  async closeSession(sessionId: string, kioskId: string): Promise<{ success: boolean }> {
    const session = await this.db.findSessionById(sessionId);
    if (!session) {
      throw new HttpException(
        { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    if (session.kioskId !== kioskId) {
      throw new HttpException(
        { code: 'FORBIDDEN', message: 'Session does not belong to this kiosk' },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.db.updateSessionStatus(sessionId, 'completed');
    await this.db.logEvent('session_closed', { sessionId }, undefined, kioskId);
    return { success: true };
  }

  async getKioskJobs(kioskId: string): Promise<DbJob[]> {
    // Returns paid and in-progress jobs for this kiosk
    const activeStatuses: JobStatus[] = ['paid', 'queued', 'printing'];
    return this.db.getKioskJobs(kioskId, activeStatuses);
  }

  async updateJobStatusByPrintAgent(
    jobId: string,
    kioskId: string,
    newStatus: JobStatus,
    reason?: string,
  ): Promise<DbJob> {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (job.kioskId !== kioskId) {
      throw new HttpException(
        { code: 'FORBIDDEN', message: 'Job does not belong to this kiosk' },
        HttpStatus.FORBIDDEN,
      );
    }

    // Validate state transition
    try {
      assertJobTransition(job.status, newStatus);
    } catch (err: unknown) {
      throw new HttpException(
        {
          code: 'INVALID_STATE_TRANSITION',
          message: err instanceof Error ? err.message : 'Invalid state transition',
        },
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.db.updateJob(job.id, {
      status: newStatus,
      printStatus: newStatus === 'printing' ? 'printing' : newStatus === 'completed' ? 'completed' : 'failed',
    });

    await this.db.logEvent('job_status_changed', { from: job.status, to: newStatus, reason }, job.id, kioskId);

    // If completed or failed, close the session so a new QR is generated
    if (newStatus === 'completed') {
      await this.db.updateSessionStatus(job.sessionId, 'completed');
    }

    return updated;
  }
}
