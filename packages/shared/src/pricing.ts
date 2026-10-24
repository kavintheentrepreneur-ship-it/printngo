import { ColorMode, PagesPerSheet, PaperSize, PaperType, PrintSides } from './enums.js';

export interface PricingOptions {
  type: PaperType;
  size: PaperSize;
  color: ColorMode;
  sides: PrintSides;
  pagesPerSheet: PagesPerSheet;
  pageCount: number;
  copies: number;
}

export interface PriceTableConfig {
  basePerSheetPaise: Record<ColorMode, Record<PaperSize, number>>;
  duplexDiscountPercent: number;
  photoSheetSurchargePaise: number;
  chartSurchargePaise: number;
  minOrderPaise: number;
  maxCopies: number;
  isPlaceholder?: boolean;
}

export const DEFAULT_PRICE_TABLE: PriceTableConfig = {
  basePerSheetPaise: {
    bw: {
      a4: 200,
      a3: 400,
      a5: 150,
      letter: 200,
      legal: 250,
    },
    color: {
      a4: 1000,
      a3: 2000,
      a5: 800,
      letter: 1000,
      legal: 1200,
    },
  },
  duplexDiscountPercent: 0,
  photoSheetSurchargePaise: 0,
  chartSurchargePaise: 0,
  minOrderPaise: 100,
  maxCopies: 20,
  isPlaceholder: true,
};

export interface PriceBreakdown {
  effectivePages: number;
  pagesPerSheet: PagesPerSheet;
  billableSheets: number;
  basePricePerSheetPaise: number;
  sheetSubtotalPaise: number;
  typeSurchargePaise: number;
  copies: number;
  totalBeforeMinimumPaise: number;
  totalPaise: number;
  totalRupeesFormatted: string;
  isPlaceholder: boolean;
}

/**
 * Calculates the exact price in paise (integer) for a print job according to domain rules.
 * Never uses floating point math for currency amounts.
 */
export function calculateJobPrice(
  options: PricingOptions,
  config: PriceTableConfig = DEFAULT_PRICE_TABLE,
): PriceBreakdown {
  if (options.pageCount <= 0) {
    throw new Error('pageCount must be at least 1');
  }

  const copies = Math.min(Math.max(1, Math.floor(options.copies)), config.maxCopies);

  // 1. Calculate how many physical page-faces are required when N-up layout is applied
  const facesNeeded = Math.ceil(options.pageCount / options.pagesPerSheet);

  // 2. Calculate physical sheets required:
  // For single side: each face requires 1 sheet.
  // For duplex: 2 faces fit on 1 sheet front and back.
  let billableSheets: number;
  if (options.sides === 'single') {
    billableSheets = facesNeeded;
  } else {
    billableSheets = Math.ceil(facesNeeded / 2);
  }

  // 3. Lookup base price per sheet for chosen size and color
  const colorRates = config.basePerSheetPaise[options.color];
  if (!colorRates) {
    throw new Error(`Invalid color mode: ${options.color}`);
  }
  const baseRate = colorRates[options.size];
  if (typeof baseRate !== 'number' || baseRate < 0) {
    throw new Error(`Invalid paper size: ${options.size} for color ${options.color}`);
  }

  // 4. Calculate sheet subtotal
  const sheetSubtotalPaise = baseRate * billableSheets;

  // 5. Type surcharges
  let typeSurchargePaise = 0;
  if (options.type === 'photo_sheet') {
    typeSurchargePaise = config.photoSheetSurchargePaise * billableSheets;
  } else if (options.type === 'chart') {
    typeSurchargePaise = config.chartSurchargePaise * billableSheets;
  }

  const perCopyPaise = sheetSubtotalPaise + typeSurchargePaise;
  const totalBeforeMinimumPaise = perCopyPaise * copies;

  // 6. Minimum order guarantee
  const totalPaise = Math.max(config.minOrderPaise, totalBeforeMinimumPaise);

  const rupees = (totalPaise / 100).toFixed(2);
  const totalRupeesFormatted = `₹${rupees}`;

  return {
    effectivePages: options.pageCount,
    pagesPerSheet: options.pagesPerSheet,
    billableSheets,
    basePricePerSheetPaise: baseRate,
    sheetSubtotalPaise,
    typeSurchargePaise,
    copies,
    totalBeforeMinimumPaise,
    totalPaise,
    totalRupeesFormatted,
    isPlaceholder: Boolean(config.isPlaceholder),
  };
}
