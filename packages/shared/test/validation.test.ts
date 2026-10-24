import { describe, expect, it } from 'vitest';
import { JobOptionsSchema, parsePageRange } from '../src/validation.js';

describe('Page Range Parser', () => {
  it('parses "all" and empty strings to full range', () => {
    expect(parsePageRange('all', 5)).toEqual([1, 2, 3, 4, 5]);
    expect(parsePageRange('ALL', 3)).toEqual([1, 2, 3]);
    expect(parsePageRange('', 4)).toEqual([1, 2, 3, 4]);
    expect(parsePageRange('   ', 2)).toEqual([1, 2]);
  });

  it('parses range strings with single pages and hyphen ranges', () => {
    expect(parsePageRange('1-3, 5, 7', 8)).toEqual([1, 2, 3, 5, 7]);
    expect(parsePageRange('  1 - 3 , 6  ', 10)).toEqual([1, 2, 3, 6]);
  });

  it('handles duplicates and unsorted inputs correctly', () => {
    expect(parsePageRange('5, 2, 1-3, 2', 6)).toEqual([1, 2, 3, 5]);
  });

  it('handles reverse range (e.g. 5-3)', () => {
    expect(parsePageRange('5-3', 10)).toEqual([3, 4, 5]);
  });

  it('throws helpful error when page is out of bounds', () => {
    expect(() => parsePageRange('1-6', 5)).toThrow(
      'This page range does not match your file. The file has 5 pages, but page 6 was requested.',
    );
    expect(() => parsePageRange('8', 5)).toThrow(
      'This page range does not match your file. The file has 5 pages, but page 8 was requested.',
    );
  });

  it('throws error for invalid format or numbers', () => {
    expect(() => parsePageRange('abc', 5)).toThrow('Invalid page number');
    expect(() => parsePageRange('0-3', 5)).toThrow('Page numbers cannot be less than 1');
  });
});

describe('Job Options Schema', () => {
  it('applies defaults correctly', () => {
    const parsed = JobOptionsSchema.parse({});
    expect(parsed.type).toBe('paper');
    expect(parsed.size).toBe('a4');
    expect(parsed.color).toBe('bw');
    expect(parsed.sides).toBe('single');
    expect(parsed.pagesPerSheet).toBe(1);
    expect(parsed.copies).toBe(1);
    expect(parsed.pageRange).toBe('all');
  });

  it('validates allowed values and rejects unknown options', () => {
    const valid = JobOptionsSchema.safeParse({
      type: 'chart',
      size: 'a3',
      color: 'color',
      sides: 'duplex',
      pagesPerSheet: 4,
      copies: 5,
    });
    expect(valid.success).toBe(true);

    const invalid = JobOptionsSchema.safeParse({
      type: 'poster', // invalid
    });
    expect(invalid.success).toBe(false);
  });
});
