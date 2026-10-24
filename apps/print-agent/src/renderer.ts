import { PagesPerSheet, PaperSize, parsePageRange } from '@printngo/shared';
import { PDFDocument } from 'pdf-lib';

// Standard paper sizes in points (72 points per inch)
export const PAPER_DIMENSIONS_PT: Record<PaperSize, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
  letter: [612.0, 792.0],
  legal: [612.0, 1008.0],
};

export interface RenderOptions {
  pageRange: string;
  pagesPerSheet: PagesPerSheet;
  size: PaperSize;
}

/**
 * Renders a final PDF ready for printer dispatch with page range extraction and N-up grid layouts.
 */
export async function renderJobDocument(
  sourcePdfBuffer: Buffer,
  options: RenderOptions,
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(sourcePdfBuffer);
  const totalSrcPages = srcDoc.getPageCount();

  // 1. Resolve page range
  const targetPageIndices = parsePageRange(options.pageRange, totalSrcPages);

  const outDoc = await PDFDocument.create();
  const [sheetWidth, sheetHeight] = PAPER_DIMENSIONS_PT[options.size];

  const nUp = options.pagesPerSheet;

  if (nUp === 1) {
    // 1-up layout: scale page to fit sheet while preserving aspect ratio
    for (const pageNum of targetPageIndices) {
      const [embeddedPage] = await outDoc.embedPdf(srcDoc, [pageNum - 1]);
      if (!embeddedPage) continue;

      const newPage = outDoc.addPage([sheetWidth, sheetHeight]);
      const { width: origW, height: origH } = embeddedPage;

      // Scale to fit with 18pt margins
      const margin = 18;
      const availW = sheetWidth - margin * 2;
      const availH = sheetHeight - margin * 2;
      const scale = Math.min(availW / origW, availH / origH);

      const drawW = origW * scale;
      const drawH = origH * scale;
      const x = (sheetWidth - drawW) / 2;
      const y = (sheetHeight - drawH) / 2;

      newPage.drawPage(embeddedPage, {
        x,
        y,
        width: drawW,
        height: drawH,
      });
    }
  } else if (nUp === 2) {
    // 2-up layout: 2 pages stacked vertically or horizontally on each sheet
    for (let i = 0; i < targetPageIndices.length; i += 2) {
      const newPage = outDoc.addPage([sheetWidth, sheetHeight]);
      const subIndices = [targetPageIndices[i], targetPageIndices[i + 1]].filter(
        (idx): idx is number => typeof idx === 'number',
      );

      const halfHeight = sheetHeight / 2;
      for (let slot = 0; slot < subIndices.length; slot++) {
        const pageNum = subIndices[slot];
        if (!pageNum) continue;
        const [embedded] = await outDoc.embedPdf(srcDoc, [pageNum - 1]);
        if (!embedded) continue;

        const margin = 12;
        const availW = sheetWidth - margin * 2;
        const availH = halfHeight - margin * 2;
        const scale = Math.min(availW / embedded.width, availH / embedded.height);

        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        const x = (sheetWidth - drawW) / 2;
        // slot 0 on top, slot 1 on bottom
        const y = (1 - slot) * halfHeight + (halfHeight - drawH) / 2;

        newPage.drawPage(embedded, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }
    }
  } else if (nUp === 3) {
    // 3-up layout: 3 horizontal bands
    for (let i = 0; i < targetPageIndices.length; i += 3) {
      const newPage = outDoc.addPage([sheetWidth, sheetHeight]);
      const subIndices = [targetPageIndices[i], targetPageIndices[i + 1], targetPageIndices[i + 2]].filter(
        (idx): idx is number => typeof idx === 'number',
      );

      const bandHeight = sheetHeight / 3;
      for (let slot = 0; slot < subIndices.length; slot++) {
        const pageNum = subIndices[slot];
        if (!pageNum) continue;
        const [embedded] = await outDoc.embedPdf(srcDoc, [pageNum - 1]);
        if (!embedded) continue;

        const margin = 10;
        const availW = sheetWidth - margin * 2;
        const availH = bandHeight - margin * 2;
        const scale = Math.min(availW / embedded.width, availH / embedded.height);

        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        const x = (sheetWidth - drawW) / 2;
        const y = (2 - slot) * bandHeight + (bandHeight - drawH) / 2;

        newPage.drawPage(embedded, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }
    }
  } else if (nUp === 4) {
    // 4-up layout: 2x2 grid
    for (let i = 0; i < targetPageIndices.length; i += 4) {
      const newPage = outDoc.addPage([sheetWidth, sheetHeight]);
      const subIndices = [
        targetPageIndices[i],
        targetPageIndices[i + 1],
        targetPageIndices[i + 2],
        targetPageIndices[i + 3],
      ].filter((idx): idx is number => typeof idx === 'number');

      const colWidth = sheetWidth / 2;
      const rowHeight = sheetHeight / 2;

      for (let slot = 0; slot < subIndices.length; slot++) {
        const pageNum = subIndices[slot];
        if (!pageNum) continue;
        const [embedded] = await outDoc.embedPdf(srcDoc, [pageNum - 1]);
        if (!embedded) continue;

        const col = slot % 2;
        const row = Math.floor(slot / 2); // 0 is top row, 1 is bottom row

        const margin = 10;
        const availW = colWidth - margin * 2;
        const availH = rowHeight - margin * 2;
        const scale = Math.min(availW / embedded.width, availH / embedded.height);

        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        const x = col * colWidth + (colWidth - drawW) / 2;
        const y = (1 - row) * rowHeight + (rowHeight - drawH) / 2;

        newPage.drawPage(embedded, {
          x,
          y,
          width: drawW,
          height: drawH,
        });
      }
    }
  }

  const outputBytes = await outDoc.save();
  return Buffer.from(outputBytes);
}
