import { describe, expect, it } from 'vitest';
import {
  formatPaiseToRupees,
  paiseToRupeeNumber,
  rupeesToPaise,
} from '../src/money.js';

describe('Money Formatter', () => {
  it('formats paise to Rupee string with two decimal places', () => {
    expect(formatPaiseToRupees(200)).toBe('₹2.00');
    expect(formatPaiseToRupees(1250)).toBe('₹12.50');
    expect(formatPaiseToRupees(5)).toBe('₹0.05');
    expect(formatPaiseToRupees(0)).toBe('₹0.00');
  });

  it('converts paise to Rupee numeric value', () => {
    expect(paiseToRupeeNumber(200)).toBe(2);
    expect(paiseToRupeeNumber(1250)).toBe(12.5);
    expect(paiseToRupeeNumber(0)).toBe(0);
  });

  it('converts Rupee value to paise safely without floating point artifacts', () => {
    expect(rupeesToPaise(2)).toBe(200);
    expect(rupeesToPaise(12.5)).toBe(1250);
    expect(rupeesToPaise('14.99')).toBe(1499);
  });
});
