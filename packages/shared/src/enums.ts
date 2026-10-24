export type JobStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'queued'
  | 'printing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'captured'
  | 'failed'
  | 'refunded';

export type PaymentMethod = 'upi_intent' | 'manual';

export type PaymentProviderType = 'razorpay' | 'manual_upi';

export type PrintStatus =
  | 'idle'
  | 'rendering'
  | 'queued'
  | 'printing'
  | 'completed'
  | 'failed';

export type KioskStatus = 'online' | 'offline' | 'paused';

export type SessionStatus =
  | 'open'
  | 'in_use'
  | 'completed'
  | 'expired'
  | 'cancelled';

export type PaperType = 'paper' | 'chart' | 'photo_sheet';

export type PaperSize = 'a4' | 'a3' | 'a5' | 'letter' | 'legal';

export type ColorMode = 'bw' | 'color';

export type PrintSides = 'single' | 'duplex';

export type PagesPerSheet = 1 | 2 | 3 | 4;

export type StaffRole = 'owner' | 'operator';
