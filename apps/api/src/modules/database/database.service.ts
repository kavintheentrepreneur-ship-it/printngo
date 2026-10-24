import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ColorMode,
  JobStatus,
  PagesPerSheet,
  PaperSize,
  PaperType,
  PaymentStatus,
  PrintSides,
  PrintStatus,
  SessionStatus,
} from '@printngo/shared';
import * as crypto from 'crypto';

export interface DbKiosk {
  id: string;
  name: string;
  location: string;
  secretHash: string;
  status: 'online' | 'offline' | 'paused';
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbSession {
  id: string;
  token: string;
  tokenHash: string;
  kioskId: string;
  status: SessionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbJob {
  id: string;
  referenceCode: string;
  sessionId: string;
  kioskId: string;
  fileId?: string;
  pageRange: string;
  type: PaperType;
  size: PaperSize;
  color: ColorMode;
  sides: PrintSides;
  pagesPerSheet: PagesPerSheet;
  pageCount: number;
  copies: number;
  pricePaise: number;
  currency: string;
  status: JobStatus;
  paymentStatus: PaymentStatus;
  printStatus: PrintStatus;
  isPlaceholder: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbFile {
  id: string;
  jobId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  sha256: string;
  createdAt: Date;
}

export interface DbPayment {
  id: string;
  jobId: string;
  provider: string;
  providerOrderId: string | null;
  amountPaise: number;
  status: PaymentStatus;
  method: string;
  rawEvent?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface DbEventLog {
  id: string;
  jobId?: string | null;
  kioskId?: string | null;
  eventType: string;
  payload?: unknown;
  createdAt: Date;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  // In-memory backing stores
  private kiosks = new Map<string, DbKiosk>();
  private sessions = new Map<string, DbSession>();
  private jobs = new Map<string, DbJob>();
  private files = new Map<string, DbFile>();
  private payments = new Map<string, DbPayment>();
  private eventLogs: DbEventLog[] = [];

  constructor(private readonly config?: ConfigService) {}

  async onModuleInit() {
    // Seed default dev kiosk if not exists
    const defaultKioskId =
      this.config?.get<string>('DEFAULT_KIOSK_ID') ||
      process.env.DEFAULT_KIOSK_ID ||
      'kiosk_dev_01';
    if (!this.kiosks.has(defaultKioskId)) {
      this.kiosks.set(defaultKioskId, {
        id: defaultKioskId,
        name: 'Printngo Main Kiosk',
        location: 'Ground Floor Reception',
        secretHash: 'sha256_mock_hash',
        status: 'online',
        lastSeenAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      this.logger.log(`Initialized default kiosk: ${defaultKioskId}`);
    }
  }

  // Helper for generating short 6-char uppercase alphanumeric reference code
  generateReferenceCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (0, O, 1, I)
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      const byte = bytes[i] ?? 0;
      code += chars[byte % chars.length];
    }
    return code;
  }

  // --- KIOSK ---
  async getKiosk(id: string): Promise<DbKiosk | null> {
    return this.kiosks.get(id) || null;
  }

  async updateKioskStatus(id: string, status: 'online' | 'offline' | 'paused'): Promise<DbKiosk | null> {
    const kiosk = this.kiosks.get(id);
    if (!kiosk) return null;
    kiosk.status = status;
    kiosk.lastSeenAt = new Date();
    kiosk.updatedAt = new Date();
    return kiosk;
  }

  // --- SESSIONS ---
  async createSession(kioskId: string, token: string, tokenHash: string, expiresAt: Date): Promise<DbSession> {
    const session: DbSession = {
      id: crypto.randomUUID(),
      token,
      tokenHash,
      kioskId,
      status: 'open',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<DbSession | null> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash) {
        return session;
      }
    }
    return null;
  }

  async findSessionById(id: string): Promise<DbSession | null> {
    return this.sessions.get(id) || null;
  }

  async updateSessionStatus(id: string, status: SessionStatus): Promise<DbSession | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    session.status = status;
    session.updatedAt = new Date();
    return session;
  }

  // --- JOBS ---
  async createJob(params: {
    sessionId: string;
    kioskId: string;
    type?: PaperType;
    size?: PaperSize;
    color?: ColorMode;
    sides?: PrintSides;
    pagesPerSheet?: PagesPerSheet;
    pageCount?: number;
    copies?: number;
    pricePaise?: number;
    isPlaceholder?: boolean;
  }): Promise<DbJob> {
    const job: DbJob = {
      id: crypto.randomUUID(),
      referenceCode: this.generateReferenceCode(),
      sessionId: params.sessionId,
      kioskId: params.kioskId,
      pageRange: 'all',
      type: params.type || 'paper',
      size: params.size || 'a4',
      color: params.color || 'bw',
      sides: params.sides || 'single',
      pagesPerSheet: params.pagesPerSheet || 1,
      pageCount: params.pageCount || 1,
      copies: params.copies || 1,
      pricePaise: params.pricePaise || 200,
      currency: 'INR',
      status: 'draft',
      paymentStatus: 'pending',
      printStatus: 'idle',
      isPlaceholder: params.isPlaceholder ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async findJobById(id: string): Promise<DbJob | null> {
    return this.jobs.get(id) || null;
  }

  async findJobByReferenceCode(code: string): Promise<DbJob | null> {
    for (const job of this.jobs.values()) {
      if (job.referenceCode.toUpperCase() === code.toUpperCase()) {
        return job;
      }
    }
    return null;
  }

  async findActiveJobBySessionId(sessionId: string): Promise<DbJob | null> {
    for (const job of this.jobs.values()) {
      if (job.sessionId === sessionId && job.status !== 'cancelled') {
        return job;
      }
    }
    return null;
  }

  async updateJob(id: string, partial: Partial<DbJob>): Promise<DbJob> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job ${id} not found`);
    }
    Object.assign(job, partial, { updatedAt: new Date() });
    return job;
  }

  async getKioskJobs(kioskId: string, statuses?: JobStatus[]): Promise<DbJob[]> {
    const list: DbJob[] = [];
    for (const job of this.jobs.values()) {
      if (job.kioskId === kioskId) {
        if (!statuses || statuses.includes(job.status)) {
          list.push(job);
        }
      }
    }
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // --- FILES ---
  async createFile(file: Omit<DbFile, 'id' | 'createdAt'>): Promise<DbFile> {
    const newFile: DbFile = {
      ...file,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    this.files.set(newFile.id, newFile);
    return newFile;
  }

  async findFileById(id: string): Promise<DbFile | null> {
    return this.files.get(id) || null;
  }

  async findFilesByJobId(jobId: string): Promise<DbFile[]> {
    return Array.from(this.files.values()).filter((f) => f.jobId === jobId);
  }

  // --- PAYMENTS ---
  async createPayment(payment: Omit<DbPayment, 'id' | 'createdAt' | 'updatedAt'>): Promise<DbPayment> {
    const newPayment: DbPayment = {
      ...payment,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.payments.set(newPayment.id, newPayment);
    return newPayment;
  }

  async findPaymentByOrderId(orderId: string): Promise<DbPayment | null> {
    for (const p of this.payments.values()) {
      if (p.providerOrderId === orderId) {
        return p;
      }
    }
    return null;
  }

  async updatePayment(id: string, partial: Partial<DbPayment>): Promise<DbPayment> {
    const payment = this.payments.get(id);
    if (!payment) throw new Error(`Payment ${id} not found`);
    Object.assign(payment, partial, { updatedAt: new Date() });
    return payment;
  }

  // --- EVENT LOGS ---
  async logEvent(eventType: string, payload?: unknown, jobId?: string, kioskId?: string): Promise<DbEventLog> {
    const log: DbEventLog = {
      id: crypto.randomUUID(),
      eventType,
      payload,
      jobId,
      kioskId,
      createdAt: new Date(),
    };
    this.eventLogs.push(log);
    return log;
  }

  async getRecentLogs(limit = 100): Promise<DbEventLog[]> {
    return this.eventLogs.slice(-limit).reverse();
  }
}
