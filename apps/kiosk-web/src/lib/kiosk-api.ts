export const KIOSK_ID = process.env.NEXT_PUBLIC_KIOSK_ID || 'kiosk_dev_01';
export const KIOSK_SECRET =
  process.env.NEXT_PUBLIC_KIOSK_SECRET || 'kiosk_super_secret_hmac_key_32_chars';
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function computeHmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SessionData {
  sessionId: string;
  token: string;
  expiresAt: string;
  qrUrl: string;
  jobId: string;
  jobReferenceCode: string;
}

export async function createKioskSession(): Promise<SessionData> {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v1/kiosk/sessions';
  const method = 'POST';
  const payload = `${method}:${path}:${timestamp}:`;

  const signature = await computeHmacHex(KIOSK_SECRET, payload);

  const res = await fetch(`${API_BASE_URL}/kiosk/sessions`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-kiosk-id': KIOSK_ID,
      'x-kiosk-timestamp': timestamp.toString(),
      'x-kiosk-signature': signature,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Failed to create kiosk session: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function fetchKioskJobs() {
  const timestamp = Math.floor(Date.now() / 1000);
  const path = '/api/v1/kiosk/jobs';
  const method = 'GET';
  const payload = `${method}:${path}:${timestamp}:`;

  const signature = await computeHmacHex(KIOSK_SECRET, payload);

  const res = await fetch(`${API_BASE_URL}/kiosk/jobs`, {
    method,
    headers: {
      'x-kiosk-id': KIOSK_ID,
      'x-kiosk-timestamp': timestamp.toString(),
      'x-kiosk-signature': signature,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch kiosk jobs: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}
