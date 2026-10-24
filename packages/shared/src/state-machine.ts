import { JobStatus } from './enums.js';

export const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled', 'draft'], // draft allowed if user modifies options before paying
  paid: ['queued', 'refund_pending'],
  queued: ['printing', 'failed', 'cancelled'],
  printing: ['completed', 'failed'],
  completed: [], // terminal state
  failed: ['refund_pending', 'cancelled'],
  cancelled: [], // terminal state
  refund_pending: ['refunded'],
  refunded: [], // terminal state
} as const;

export class InvalidStateTransitionError extends Error {
  public readonly code = 'INVALID_STATE_TRANSITION';
  public readonly status = 409;

  constructor(
    public readonly from: JobStatus,
    public readonly to: JobStatus,
    message?: string,
  ) {
    super(
      message ||
        `Cannot transition job from status '${from}' to '${to}'. Allowed transitions: [${ALLOWED_JOB_TRANSITIONS[from].join(', ')}]`,
    );
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Validates whether a transition from one job state to another is allowed by the domain state machine.
 */
export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_JOB_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Throws InvalidStateTransitionError if the transition is disallowed.
 */
export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new InvalidStateTransitionError(from, to);
  }
}
