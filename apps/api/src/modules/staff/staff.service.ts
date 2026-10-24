import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { assertJobTransition, DEFAULT_PRICE_TABLE, JobStatus, PriceTableConfig } from '@printngo/shared';
import { DatabaseService, DbJob } from '../database/database.service';
import { KioskGateway } from '../realtime/kiosk.gateway';

@Injectable()
export class StaffService {
  private currentPricingConfig: PriceTableConfig = { ...DEFAULT_PRICE_TABLE };
  private pricingVersion = 1;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(KioskGateway) private readonly kioskGateway: KioskGateway,
  ) {}

  async listJobs(filter?: {
    status?: JobStatus;
    kioskId?: string;
    limit?: number;
  }): Promise<{ jobs: DbJob[]; total: number }> {
    const allJobs = await this.db.getKioskJobs(
      filter?.kioskId || 'kiosk_dev_01',
      filter?.status ? [filter.status] : undefined,
    );
    const limit = filter?.limit || 50;
    return {
      jobs: allJobs.slice(0, limit),
      total: allJobs.length,
    };
  }

  async getPricing(): Promise<{ config: PriceTableConfig; version: number }> {
    return {
      config: this.currentPricingConfig,
      version: this.pricingVersion,
    };
  }

  async updatePricing(
    newConfig: Partial<PriceTableConfig>,
    updatedBy = 'admin@printngo.com',
  ): Promise<{ config: PriceTableConfig; version: number }> {
    this.currentPricingConfig = {
      ...this.currentPricingConfig,
      ...newConfig,
      isPlaceholder: false,
    };
    this.pricingVersion += 1;

    await this.db.logEvent('pricing_rules_updated', {
      version: this.pricingVersion,
      updatedBy,
      newConfig,
    });

    this.kioskGateway.server?.emit('pricing:updated', {
      version: this.pricingVersion,
    });

    return {
      config: this.currentPricingConfig,
      version: this.pricingVersion,
    };
  }

  async reprintJob(jobId: string, staffUser = 'admin@printngo.com'): Promise<DbJob> {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (job.status !== 'completed' && job.status !== 'failed') {
      throw new HttpException(
        {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Only completed or failed jobs can be reprinted by staff.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Reset status to paid for the print agent
    const updated = await this.db.updateJob(job.id, {
      status: 'paid',
      printStatus: 'idle',
    });

    await this.db.logEvent('staff_job_reprinted', { staffUser, jobId }, jobId, job.kioskId);
    this.kioskGateway.emitJobPaid(job.kioskId, updated);

    return updated;
  }

  async refundJob(jobId: string, staffUser = 'admin@printngo.com'): Promise<DbJob> {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (job.status !== 'failed' && job.status !== 'cancelled' && job.status !== 'paid') {
      throw new HttpException(
        {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Only failed, cancelled, or paid unprinted jobs can be refunded.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Move to refund_pending then refunded
    assertJobTransition(job.status, 'refund_pending');
    await this.db.updateJob(job.id, {
      status: 'refund_pending',
      paymentStatus: 'refunded',
    });

    assertJobTransition('refund_pending', 'refunded');
    const finalJob = await this.db.updateJob(job.id, {
      status: 'refunded',
      paymentStatus: 'refunded',
    });

    await this.db.logEvent('staff_job_refunded', { staffUser, jobId, amountPaise: job.pricePaise }, jobId, job.kioskId);
    this.kioskGateway.emitJobStatusChanged(job.kioskId, job.id, 'refunded', 'Refunded by staff');

    return finalJob;
  }

  async getEventLogs(limit = 100) {
    return this.db.getRecentLogs(limit);
  }
}
