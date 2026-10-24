import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  assertJobTransition,
  calculateJobPrice,
  ColorMode,
  DEFAULT_PRICE_TABLE,
  PagesPerSheet,
  PaperSize,
  PaperType,
  parsePageRange,
  PriceBreakdown,
  PrintSides,
  UpdateJobOptionsInput,
} from '@printngo/shared';
import { DatabaseService, DbJob } from '../database/database.service';

export interface JobWithOptionsResult {
  job: DbJob;
  priceBreakdown: PriceBreakdown;
}

@Injectable()
export class JobsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  calculateBreakdown(job: DbJob): PriceBreakdown {
    // If pageRange is custom, effective pages is the parsed range count
    let effectivePageCount = job.pageCount;
    if (job.pageRange && job.pageRange.toLowerCase() !== 'all') {
      try {
        const pages = parsePageRange(job.pageRange, job.pageCount);
        effectivePageCount = pages.length;
      } catch {
        effectivePageCount = job.pageCount;
      }
    }

    return calculateJobPrice(
      {
        type: job.type as PaperType,
        size: job.size as PaperSize,
        color: job.color as ColorMode,
        sides: job.sides as PrintSides,
        pagesPerSheet: job.pagesPerSheet as PagesPerSheet,
        pageCount: effectivePageCount,
        copies: job.copies,
      },
      DEFAULT_PRICE_TABLE,
    );
  }

  async updateJobOptions(
    jobId: string,
    options: UpdateJobOptionsInput,
  ): Promise<JobWithOptionsResult> {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Rules: Options can only be changed while status is draft
    if (job.status !== 'draft') {
      throw new HttpException(
        {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Options can only be edited while job is in draft state.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Validate page range if provided
    if (options.pageRange !== undefined) {
      try {
        parsePageRange(options.pageRange, job.pageCount);
      } catch (err: unknown) {
        throw new HttpException(
          {
            code: 'INVALID_PAGE_RANGE',
            message: err instanceof Error ? err.message : 'Invalid page range.',
            field: 'pageRange',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // Update job in database
    const updated = await this.db.updateJob(job.id, {
      ...(options.type ? { type: options.type as PaperType } : {}),
      ...(options.size ? { size: options.size as PaperSize } : {}),
      ...(options.color ? { color: options.color as ColorMode } : {}),
      ...(options.sides ? { sides: options.sides as PrintSides } : {}),
      ...(options.pagesPerSheet ? { pagesPerSheet: options.pagesPerSheet as PagesPerSheet } : {}),
      ...(options.pageRange !== undefined ? { pageRange: options.pageRange } : {}),
      ...(options.copies !== undefined ? { copies: Math.min(20, Math.max(1, options.copies)) } : {}),
    });

    const breakdown = this.calculateBreakdown(updated);
    // Sync pricePaise on draft job
    await this.db.updateJob(updated.id, { pricePaise: breakdown.totalPaise });
    updated.pricePaise = breakdown.totalPaise;

    await this.db.logEvent('job_options_updated', { jobId, options }, jobId, job.kioskId);

    return {
      job: updated,
      priceBreakdown: breakdown,
    };
  }

  async getPrice(jobId: string): Promise<{ priceBreakdown: PriceBreakdown }> {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { priceBreakdown: this.calculateBreakdown(job) };
  }

  async proceedToPayment(jobId: string): Promise<JobWithOptionsResult> {
    const job = await this.db.findJobById(jobId);
    if (!job) {
      throw new HttpException(
        { code: 'JOB_NOT_FOUND', message: 'Job not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Idempotency: if already awaiting_payment, return current state
    if (job.status === 'awaiting_payment') {
      return {
        job,
        priceBreakdown: this.calculateBreakdown(job),
      };
    }

    // Must have at least 1 file uploaded before proceeding
    const files = await this.db.findFilesByJobId(jobId);
    if (files.length === 0) {
      throw new HttpException(
        {
          code: 'FILE_REQUIRED',
          message: 'Please upload a file before proceeding to print.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // State transition check
    assertJobTransition(job.status, 'awaiting_payment');

    // Recalculate and lock price
    const breakdown = this.calculateBreakdown(job);
    const updated = await this.db.updateJob(job.id, {
      status: 'awaiting_payment',
      pricePaise: breakdown.totalPaise,
    });

    await this.db.logEvent(
      'job_price_locked',
      { jobId, lockedPricePaise: breakdown.totalPaise },
      jobId,
      job.kioskId,
    );

    return {
      job: updated,
      priceBreakdown: breakdown,
    };
  }
}
