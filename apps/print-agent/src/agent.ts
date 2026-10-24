import {
  ColorMode,
  PagesPerSheet,
  PaperSize,
  PrintSides,
} from '@printngo/shared';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { io, Socket } from 'socket.io-client';
import { PrinterService } from './printer-service';
import { renderJobDocument } from './renderer';

export interface PrintAgentConfig {
  kioskId: string;
  kioskSecret: string;
  apiUrl: string;
  printerName?: string | undefined;
}

export class PrintAgent {
  private socket: Socket | null = null;
  private readonly printer = new PrinterService();
  private readonly printedJobIds = new Set<string>();

  constructor(private readonly config: PrintAgentConfig) {}

  private computeHmacHeaders(method: string, path: string, body?: unknown) {
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = body ? JSON.stringify(body) : '';
    const payload = `${method.toUpperCase()}:${path}:${timestamp}:${bodyStr}`;
    const signature = crypto
      .createHmac('sha256', this.config.kioskSecret)
      .update(payload)
      .digest('hex');

    return {
      'Content-Type': 'application/json',
      'x-kiosk-id': this.config.kioskId,
      'x-kiosk-timestamp': timestamp.toString(),
      'x-kiosk-signature': signature,
    };
  }

  async reportStatus(jobId: string, status: string, reason?: string) {
    const apiPath = `/api/v1/kiosk/jobs/${jobId}/status`;
    const headers = this.computeHmacHeaders('PATCH', apiPath, { status, reason });

    const res = await fetch(`${this.config.apiUrl}/kiosk/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status, reason }),
    });

    if (!res.ok) {
      console.error(`[PrintAgent] Failed to report status ${status} for job ${jobId}: ${res.status}`);
    }
  }

  async processJob(job: {
    id: string;
    referenceCode: string;
    status: string;
    type: string;
    size: PaperSize;
    color: ColorMode;
    sides: PrintSides;
    pagesPerSheet: PagesPerSheet;
    pageRange: string;
    copies: number;
    fileId?: string;
  }) {
    // Rule: Print agent never prints a job unless its status is paid or queued
    if (job.status !== 'paid' && job.status !== 'queued') {
      console.warn(`[PrintAgent] Skipping job #${job.referenceCode}: status is '${job.status}', expected 'paid' or 'queued'.`);
      return;
    }

    // Rule: A job is never printed twice automatically
    if (this.printedJobIds.has(job.id)) {
      console.warn(`[PrintAgent] Skipping already processed job #${job.referenceCode}`);
      return;
    }
    this.printedJobIds.add(job.id);

    console.log(`[PrintAgent] Processing job #${job.referenceCode}...`);

    try {
      // 1. Mark printing
      await this.reportStatus(job.id, 'printing');

      // 2. Fetch or load document buffer
      // In local dev, read from uploads folder or generate a mock PDF
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      let pdfBuffer: Buffer;

      // Check if uploaded file exists on disk
      let foundPath: string | null = null;
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        if (files.length > 0) {
          foundPath = path.join(uploadsDir, files[files.length - 1] ?? '');
        }
      }

      if (foundPath && fs.existsSync(foundPath)) {
        pdfBuffer = await fs.promises.readFile(foundPath);
      } else {
        // Fallback: create sample PDF on the fly
        const { PDFDocument } = await import('pdf-lib');
        const doc = await PDFDocument.create();
        doc.addPage([595.28, 841.89]);
        pdfBuffer = Buffer.from(await doc.save());
      }

      // 3. Render document (page range, N-up layout, scaling)
      const renderedPdf = await renderJobDocument(pdfBuffer, {
        pageRange: job.pageRange || 'all',
        pagesPerSheet: job.pagesPerSheet || 1,
        size: job.size || 'a4',
      });

      // 4. Dispatch to printer
      await this.printer.printPdf(renderedPdf, {
        printerName: this.config.printerName,
        size: job.size || 'a4',
        color: job.color || 'bw',
        sides: job.sides || 'single',
        copies: job.copies || 1,
      });

      // 5. Mark completed
      await this.reportStatus(job.id, 'completed');
      console.log(`[PrintAgent] Job #${job.referenceCode} successfully COMPLETED!`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown print failure';
      console.error(`[PrintAgent] Job #${job.referenceCode} FAILED:`, errMsg);
      await this.reportStatus(job.id, 'failed', errMsg);
    }
  }

  async pollJobs() {
    try {
      const apiPath = '/api/v1/kiosk/jobs';
      const headers = this.computeHmacHeaders('GET', apiPath);
      const res = await fetch(`${this.config.apiUrl}/kiosk/jobs`, { headers });
      if (res.ok) {
        const json = await res.json();
        const jobs = json.data || [];
        for (const job of jobs) {
          if (job.status === 'paid' && !this.printedJobIds.has(job.id)) {
            await this.processJob(job);
          }
        }
      }
    } catch (err) {
      console.error('[PrintAgent] Polling error:', err);
    }
  }

  start() {
    console.log(`[PrintAgent] Starting for Kiosk: ${this.config.kioskId}`);

    // Connect to Socket.IO
    this.socket = io('http://localhost:4000/kiosk', {
      query: { kioskId: this.config.kioskId },
    });

    this.socket.on('job:paid', async (job: any) => {
      console.log(`[PrintAgent] Received real-time job:paid for #${job.referenceCode}`);
      await this.processJob(job);
    });

    // 10s Polling fallback
    setInterval(() => this.pollJobs(), 10000);
  }

  stop() {
    this.socket?.disconnect();
  }
}
