import { PrintAgent } from './agent';

const kioskId = process.env.DEFAULT_KIOSK_ID || 'kiosk_dev_01';
const kioskSecret =
  process.env.DEFAULT_KIOSK_SECRET || 'kiosk_super_secret_hmac_key_32_chars';
const apiUrl = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';
const printerName = process.env.PRINTER_NAME || undefined;

const agent = new PrintAgent({
  kioskId,
  kioskSecret,
  apiUrl,
  printerName,
});

agent.start();
