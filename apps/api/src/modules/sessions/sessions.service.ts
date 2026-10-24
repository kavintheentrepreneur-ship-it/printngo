import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { calculateJobPrice, DEFAULT_PRICE_TABLE, PriceBreakdown } from '@printngo/shared';
import * as crypto from 'crypto';
import { DocumentProcessorService } from '../../common/services/document-processor.service';
import { StorageService } from '../../common/services/storage.service';
import { DatabaseService, DbFile, DbJob } from '../database/database.service';

export interface SessionResumeData {
  session: {
    id: string;
    kioskId: string;
    status: string;
    expiresAt: string;
  };
  job: DbJob;
  files: DbFile[];
  priceBreakdown: PriceBreakdown;
}

@Injectable()
export class SessionsService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(StorageService) private readonly storage: StorageService,
    @Inject(DocumentProcessorService)
    private readonly docProcessor: DocumentProcessorService,
  ) {}

  private calculateBreakdown(job: DbJob): PriceBreakdown {
    return calculateJobPrice(
      {
        type: job.type,
        size: job.size,
        color: job.color,
        sides: job.sides,
        pagesPerSheet: job.pagesPerSheet,
        pageCount: job.pageCount,
        copies: job.copies,
      },
      DEFAULT_PRICE_TABLE,
    );
  }

  async validateAndGetSession(rawToken: string): Promise<SessionResumeData> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const session = await this.db.findSessionByTokenHash(tokenHash);

    if (!session) {
      throw new HttpException(
        {
          code: 'SESSION_NOT_FOUND',
          message: 'Invalid kiosk session token. Please scan the QR code on the kiosk screen.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const now = new Date();
    const isExpired =
      session.status === 'expired' ||
      session.status === 'cancelled' ||
      session.status === 'completed' ||
      now > new Date(session.expiresAt);

    if (isExpired) {
      if (session.status !== 'expired' && session.status !== 'completed' && session.status !== 'cancelled') {
        await this.db.updateSessionStatus(session.id, 'expired');
      }
      throw new HttpException(
        {
          code: 'SESSION_EXPIRED',
          message: 'This kiosk session has ended. Please scan the new QR code on the screen.',
        },
        HttpStatus.GONE,
      );
    }

    let job = await this.db.findActiveJobBySessionId(session.id);
    if (!job) {
      job = await this.db.createJob({
        sessionId: session.id,
        kioskId: session.kioskId,
        type: 'paper',
        size: 'a4',
        color: 'bw',
        sides: 'single',
        pagesPerSheet: 1,
        copies: 1,
        pageCount: 1,
        pricePaise: 200,
      });
    }

    const files = await this.db.findFilesByJobId(job.id);
    const breakdown = this.calculateBreakdown(job);

    return {
      session: {
        id: session.id,
        kioskId: session.kioskId,
        status: session.status,
        expiresAt: session.expiresAt.toISOString(),
      },
      job,
      files,
      priceBreakdown: breakdown,
    };
  }

  async uploadFileForSession(
    rawToken: string,
    fileBuffer: Buffer,
    originalName: string,
  ): Promise<{ file: DbFile; job: DbJob; priceBreakdown: PriceBreakdown }> {
    const sessionData = await this.validateAndGetSession(rawToken);
    const job = sessionData.job;

    if (job.status !== 'draft') {
      throw new HttpException(
        {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Files can only be uploaded while the job is in draft mode.',
        },
        HttpStatus.CONFLICT,
      );
    }

    // Save to storage (checks magic bytes and 25 MB limit)
    const stored = await this.storage.saveFile(fileBuffer, originalName);

    // Count pages using document processor
    const pageCount = await this.docProcessor.countPages(fileBuffer, stored.mimeType);

    // Record in DB
    const dbFile = await this.db.createFile({
      jobId: job.id,
      storageKey: stored.storageKey,
      originalName: stored.originalName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      pageCount,
      sha256: stored.sha256,
    });

    // Update job pageCount and recalculate price
    const updatedJob = await this.db.updateJob(job.id, {
      fileId: dbFile.id,
      pageCount,
    });

    const breakdown = this.calculateBreakdown(updatedJob);
    await this.db.updateJob(updatedJob.id, { pricePaise: breakdown.totalPaise });
    updatedJob.pricePaise = breakdown.totalPaise;

    await this.db.logEvent('file_uploaded', { fileId: dbFile.id, pageCount }, job.id, job.kioskId);

    return {
      file: dbFile,
      job: updatedJob,
      priceBreakdown: breakdown,
    };
  }
}
