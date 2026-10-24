import {
  confirmPaymentForJob,
  getOrCreateSession,
  getPaymentLinksForJob,
  proceedJob,
  saveFileForSession,
  updateOptionsForJob,
} from './mock-store';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export interface CustomerSessionResponse {
  session: {
    id: string;
    kioskId: string;
    status: string;
    expiresAt: string;
  };
  job: {
    id: string;
    referenceCode: string;
    sessionId: string;
    kioskId: string;
    fileId?: string;
    pageRange: string;
    type: 'paper' | 'chart' | 'photo_sheet';
    size: 'a4' | 'a3' | 'a5' | 'letter' | 'legal';
    color: 'bw' | 'color';
    sides: 'single' | 'duplex';
    pagesPerSheet: 1 | 2 | 3 | 4;
    pageCount: number;
    copies: number;
    pricePaise: number;
    status: string;
    paymentStatus: string;
  };
  files: Array<{
    id: string;
    originalName: string;
    sizeBytes: number;
    pageCount: number;
    mimeType: string;
  }>;
  priceBreakdown: {
    billableSheets: number;
    basePricePerSheetPaise: number;
    copies: number;
    totalPaise: number;
    totalRupeesFormatted: string;
    isPlaceholder: boolean;
  };
}

export async function fetchCustomerSession(token: string): Promise<CustomerSessionResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/sessions/${token}`, {
      headers: {
        'x-session-token': token,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) return json.data;
    }
  } catch (err) {
    console.warn('Network call failed, using seamless mock session:', err);
  }

  // Fallback to seamless session store
  return getOrCreateSession(token);
}

export async function uploadCustomerFile(
  token: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ file: any; job: any; priceBreakdown: any }> {
  try {
    if (onProgress) onProgress(40);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/sessions/${token}/files`, {
      method: 'POST',
      headers: {
        'x-session-token': token,
      },
      body: formData,
    });

    if (onProgress) onProgress(100);

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) return json.data;
    }
  } catch (err) {
    console.warn('File upload endpoint unreachable, falling back to seamless local file:', err);
  }

  if (onProgress) onProgress(100);
  return saveFileForSession(token, {
    name: file.name,
    size: file.size,
    pageCount: file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg') ? 1 : 3,
    mimeType: file.type || 'application/pdf',
  });
}

export async function updateJobOptions(
  token: string,
  jobId: string,
  options: Record<string, unknown>,
) {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/options`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify(options),
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) return json.data;
    }
  } catch (err) {
    console.warn('Option save fallback:', err);
  }

  return updateOptionsForJob(jobId, options);
}

export async function proceedToPayment(token: string, jobId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/proceed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) return json.data;
    }
  } catch (err) {
    console.warn('Proceed fallback:', err);
  }

  return proceedJob(jobId);
}

export async function fetchPaymentLinks(token: string, jobId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/payment-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
    });

    if (res.ok) {
      const json = await res.json();
      if (json && json.data) return json.data;
    }
  } catch (err) {
    console.warn('Payment links fallback:', err);
  }

  return getPaymentLinksForJob(jobId);
}

export async function simulatePaymentSuccess(token: string, jobId: string) {
  try {
    await fetch(`${API_BASE_URL}/jobs/${jobId}/payment-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
    });
  } catch {}

  return confirmPaymentForJob(jobId);
}
