import {
  calculateJobPrice,
  ColorMode,
  DEFAULT_PRICE_TABLE,
  formatPaiseToRupees,
  PagesPerSheet,
  PaperSize,
  PaperType,
  parsePageRange,
  PrintSides,
} from '@printngo/shared';

export interface StoredJob {
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
  status: string;
  paymentStatus: string;
  lockedPricePaise?: number;
}

export interface StoredSession {
  id: string;
  kioskId: string;
  status: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface StoredFile {
  id: string;
  originalName: string;
  sizeBytes: number;
  pageCount: number;
  mimeType: string;
}

// In-memory persistent map for serverless / client fallback
const sessions = new Map<string, StoredSession>();
const jobs = new Map<string, StoredJob>();
const files = new Map<string, StoredFile[]>();

function generateRefCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getOrCreateSession(token: string): {
  session: StoredSession;
  job: StoredJob;
  files: StoredFile[];
  priceBreakdown: any;
} {
  let session = sessions.get(token);
  let job: StoredJob | undefined;

  if (!session) {
    const sessionId = `sess_${token.slice(0, 8)}`;
    session = {
      id: sessionId,
      kioskId: 'kiosk_dev_01',
      status: 'open',
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    sessions.set(token, session);

    const initialPrice = calculateJobPrice(
      {
        type: 'paper',
        size: 'a4',
        color: 'bw',
        sides: 'single',
        pagesPerSheet: 1,
        pageCount: 1,
        copies: 1,
      },
      DEFAULT_PRICE_TABLE,
    );

    job = {
      id: `job_${token.slice(0, 8)}`,
      referenceCode: generateRefCode(),
      sessionId: session.id,
      kioskId: session.kioskId,
      pageRange: 'all',
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 1,
      copies: 1,
      pricePaise: initialPrice.totalPaise,
      status: 'draft',
      paymentStatus: 'pending',
    };
    jobs.set(job.id, job);
    files.set(session.id, []);
  } else {
    job = Array.from(jobs.values()).find((j) => j.sessionId === session?.id);
    if (!job) {
      job = {
        id: `job_${session.id}`,
        referenceCode: generateRefCode(),
        sessionId: session.id,
        kioskId: session.kioskId,
        pageRange: 'all',
        type: 'paper',
        size: 'a4',
        color: 'bw',
        sides: 'single',
        pagesPerSheet: 1,
        pageCount: 1,
        copies: 1,
        pricePaise: 200,
        status: 'draft',
        paymentStatus: 'pending',
      };
      jobs.set(job.id, job);
    }
  }

  const jobFiles = files.get(session.id) || [];
  const breakdown = calculateJobPrice(
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

  return {
    session,
    job,
    files: jobFiles,
    priceBreakdown: {
      ...breakdown,
      totalRupeesFormatted: formatPaiseToRupees(breakdown.totalPaise),
      isPlaceholder: false,
    },
  };
}

export function saveFileForSession(
  token: string,
  fileMeta: { name: string; size: number; pageCount?: number; mimeType?: string },
) {
  const { session, job } = getOrCreateSession(token);
  const detectedPages = fileMeta.pageCount && fileMeta.pageCount > 0 ? fileMeta.pageCount : 3;

  const newFile: StoredFile = {
    id: `file_${Date.now()}`,
    originalName: fileMeta.name,
    sizeBytes: fileMeta.size || 1024 * 50,
    pageCount: detectedPages,
    mimeType: fileMeta.mimeType || 'application/pdf',
  };

  const list = files.get(session.id) || [];
  list.push(newFile);
  files.set(session.id, list);

  job.fileId = newFile.id;
  job.pageCount = detectedPages;

  const breakdown = calculateJobPrice(
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
  job.pricePaise = breakdown.totalPaise;

  return {
    file: newFile,
    job,
    priceBreakdown: {
      ...breakdown,
      totalRupeesFormatted: formatPaiseToRupees(breakdown.totalPaise),
    },
  };
}

export function updateOptionsForJob(jobId: string, options: Partial<StoredJob>) {
  const job = jobs.get(jobId);
  if (!job) {
    // If not found in memory, create a fallback
    const fallback: StoredJob = {
      id: jobId,
      referenceCode: generateRefCode(),
      sessionId: 'sess_default',
      kioskId: 'kiosk_dev_01',
      pageRange: 'all',
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 3,
      copies: 1,
      pricePaise: 600,
      status: 'draft',
      paymentStatus: 'pending',
      ...options,
    };
    jobs.set(jobId, fallback);
    return fallback;
  }

  // Merge options
  Object.assign(job, options);

  // Recalculate billable pages if page range is provided
  let effectivePages = job.pageCount || 1;
  if (job.pageRange && job.pageRange !== 'all') {
    try {
      const parsed = parsePageRange(job.pageRange, job.pageCount);
      effectivePages = parsed.length;
    } catch {}
  }

  const breakdown = calculateJobPrice(
    {
      type: job.type,
      size: job.size,
      color: job.color,
      sides: job.sides,
      pagesPerSheet: job.pagesPerSheet,
      pageCount: effectivePages,
      copies: job.copies || 1,
    },
    DEFAULT_PRICE_TABLE,
  );

  job.pricePaise = breakdown.totalPaise;
  return job;
}

export function proceedJob(jobId: string) {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'awaiting_payment';
    job.lockedPricePaise = job.pricePaise;
    return job;
  }
  return {
    id: jobId,
    status: 'awaiting_payment',
    pricePaise: 400,
    referenceCode: 'PNG777',
  };
}

export function getPaymentLinksForJob(jobId: string) {
  const job = jobs.get(jobId);
  const amountPaise = job?.pricePaise || 400;
  const refCode = job?.referenceCode || 'PNG777';
  const amountRupees = (amountPaise / 100).toFixed(2);

  const upiId = 'printngo@okhdfcbank';
  const payeeName = 'PrintNGo';
  const orderId = `order_${jobId}`;

  const baseUpiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(
    payeeName,
  )}&am=${amountRupees}&cu=INR&tn=${refCode}&tr=${orderId}`;

  return {
    jobId,
    amountPaise,
    amountRupees,
    upiId,
    payeeName,
    paymentOrderId: orderId,
    upiLinks: {
      gpay: baseUpiLink,
      phonepe: baseUpiLink,
      generic: baseUpiLink,
    },
  };
}

export function confirmPaymentForJob(jobId: string) {
  const job = jobs.get(jobId);
  if (job) {
    job.status = 'paid';
    job.paymentStatus = 'captured';
  }
  return { isPaid: true, status: 'paid' };
}
