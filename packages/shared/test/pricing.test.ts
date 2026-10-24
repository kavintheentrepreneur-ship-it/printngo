import { describe, expect, it } from 'vitest';
import { calculateJobPrice, DEFAULT_PRICE_TABLE } from '../src/pricing.js';

describe('Pricing Engine', () => {
  it('calculates single-sided 1-page A4 B&W correctly', () => {
    const result = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 1,
      copies: 1,
    });

    // A4 BW base is 200 paise = ₹2.00
    expect(result.billableSheets).toBe(1);
    expect(result.totalPaise).toBe(200);
    expect(result.totalRupeesFormatted).toBe('₹2.00');
    expect(result.isPlaceholder).toBe(true);
  });

  it('calculates single-sided 5-page A4 Color correctly', () => {
    const result = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'color',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 5,
      copies: 1,
    });

    // 5 pages * 1000 paise = 5000 paise = ₹50.00
    expect(result.billableSheets).toBe(5);
    expect(result.totalPaise).toBe(5000);
    expect(result.totalRupeesFormatted).toBe('₹50.00');
  });

  it('calculates duplex (double-sided) with odd page count rounding up', () => {
    // 5 pages duplex: 5 faces needed -> ceil(5/2) = 3 physical sheets
    const result = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'duplex',
      pagesPerSheet: 1,
      pageCount: 5,
      copies: 1,
    });

    expect(result.billableSheets).toBe(3);
    // 3 sheets * 200 paise = 600 paise
    expect(result.totalPaise).toBe(600);
    expect(result.totalRupeesFormatted).toBe('₹6.00');
  });

  it('calculates 2-pages-per-sheet N-up layout correctly', () => {
    // 5 pages at 2 per sheet: ceil(5/2) = 3 faces
    // single sided: 3 faces = 3 sheets
    const singleResult = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 2,
      pageCount: 5,
      copies: 1,
    });
    expect(singleResult.billableSheets).toBe(3);
    expect(singleResult.totalPaise).toBe(600);

    // duplex: 3 faces on duplex -> ceil(3/2) = 2 sheets
    const duplexResult = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'duplex',
      pagesPerSheet: 2,
      pageCount: 5,
      copies: 1,
    });
    expect(duplexResult.billableSheets).toBe(2);
    expect(duplexResult.totalPaise).toBe(400);
  });

  it('calculates 4-pages-per-sheet layout correctly', () => {
    // 10 pages at 4 per sheet: ceil(10/4) = 3 faces
    // duplex: ceil(3/2) = 2 sheets
    const result = calculateJobPrice({
      type: 'paper',
      size: 'a3',
      color: 'color',
      sides: 'duplex',
      pagesPerSheet: 4,
      pageCount: 10,
      copies: 1,
    });
    // A3 Color base is 2000 paise per sheet. 2 sheets = 4000 paise
    expect(result.billableSheets).toBe(2);
    expect(result.totalPaise).toBe(4000);
    expect(result.totalRupeesFormatted).toBe('₹40.00');
  });

  it('multiplies price by copies correctly', () => {
    const result = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 2, // 2 sheets * 200 = 400 paise
      copies: 3,
    });

    expect(result.copies).toBe(3);
    expect(result.totalPaise).toBe(1200);
    expect(result.totalRupeesFormatted).toBe('₹12.00');
  });

  it('clamps copies to maximum allowed copies (20)', () => {
    const result = calculateJobPrice({
      type: 'paper',
      size: 'a4',
      color: 'bw',
      sides: 'single',
      pagesPerSheet: 1,
      pageCount: 1,
      copies: 50, // exceeds maxCopies: 20
    });

    expect(result.copies).toBe(20);
    expect(result.totalPaise).toBe(4000); // 20 * 200 paise
  });

  it('applies minimum order price if subtotal is below minimum', () => {
    const customConfig = {
      ...DEFAULT_PRICE_TABLE,
      basePerSheetPaise: {
        ...DEFAULT_PRICE_TABLE.basePerSheetPaise,
        bw: { ...DEFAULT_PRICE_TABLE.basePerSheetPaise.bw, a5: 50 },
      },
      minOrderPaise: 100, // min ₹1.00
    };

    const result = calculateJobPrice(
      {
        type: 'paper',
        size: 'a5',
        color: 'bw',
        sides: 'single',
        pagesPerSheet: 1,
        pageCount: 1, // 50 paise
        copies: 1,
      },
      customConfig,
    );

    expect(result.totalBeforeMinimumPaise).toBe(50);
    expect(result.totalPaise).toBe(100);
    expect(result.totalRupeesFormatted).toBe('₹1.00');
  });

  it('throws error for invalid page count', () => {
    expect(() =>
      calculateJobPrice({
        type: 'paper',
        size: 'a4',
        color: 'bw',
        sides: 'single',
        pagesPerSheet: 1,
        pageCount: 0,
        copies: 1,
      }),
    ).toThrow('pageCount must be at least 1');
  });
});
