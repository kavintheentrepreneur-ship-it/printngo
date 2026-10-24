import { describe, expect, it } from 'vitest';
import {
  assertJobTransition,
  canTransitionJob,
  InvalidStateTransitionError,
} from '../src/state-machine.js';

describe('Job State Machine', () => {
  it('allows valid forward transitions', () => {
    expect(canTransitionJob('draft', 'awaiting_payment')).toBe(true);
    expect(canTransitionJob('awaiting_payment', 'paid')).toBe(true);
    expect(canTransitionJob('paid', 'queued')).toBe(true);
    expect(canTransitionJob('queued', 'printing')).toBe(true);
    expect(canTransitionJob('printing', 'completed')).toBe(true);
  });

  it('allows cancellation from draft, awaiting_payment, or queued', () => {
    expect(canTransitionJob('draft', 'cancelled')).toBe(true);
    expect(canTransitionJob('awaiting_payment', 'cancelled')).toBe(true);
    expect(canTransitionJob('queued', 'cancelled')).toBe(true);
  });

  it('allows reverting awaiting_payment back to draft for option edits', () => {
    expect(canTransitionJob('awaiting_payment', 'draft')).toBe(true);
  });

  it('allows failure transitions from printing or queued', () => {
    expect(canTransitionJob('queued', 'failed')).toBe(true);
    expect(canTransitionJob('printing', 'failed')).toBe(true);
    expect(canTransitionJob('failed', 'refund_pending')).toBe(true);
    expect(canTransitionJob('refund_pending', 'refunded')).toBe(true);
  });

  it('rejects invalid state transitions with InvalidStateTransitionError', () => {
    expect(canTransitionJob('draft', 'completed')).toBe(false);
    expect(canTransitionJob('completed', 'draft')).toBe(false);
    expect(canTransitionJob('paid', 'draft')).toBe(false);
    expect(canTransitionJob('draft', 'printing')).toBe(false);

    expect(() => assertJobTransition('draft', 'completed')).toThrow(
      InvalidStateTransitionError,
    );

    try {
      assertJobTransition('completed', 'draft');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStateTransitionError);
      const error = err as InvalidStateTransitionError;
      expect(error.status).toBe(409);
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
    }
  });

  it('allows identity transition (staying in same state)', () => {
    expect(canTransitionJob('draft', 'draft')).toBe(true);
    expect(canTransitionJob('paid', 'paid')).toBe(true);
  });
});
