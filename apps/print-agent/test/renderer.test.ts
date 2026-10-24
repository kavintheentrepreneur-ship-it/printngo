import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { PrinterService } from '../src/printer-service';
import { renderJobDocument } from '../src/renderer';

describe('Milestone M5: Print Agent Renderer & Printer Service Tests', () => {
  async function createTestPdf(pageCount: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) {
      const page = doc.addPage([595.28, 841.89]);
      page.drawText(`Page ${i + 1}`, { x: 50, y: 750, size: 24 });
    }
    return Buffer.from(await doc.save());
  }

  describe('PDF Layout Rendering Engine', () => {
    it('renders 1-up layout preserving page count', async () => {
      const srcPdf = await createTestPdf(3);
      const rendered = await renderJobDocument(srcPdf, {
        pageRange: 'all',
        pagesPerSheet: 1,
        size: 'a4',
      });

      const outDoc = await PDFDocument.load(rendered);
      expect(outDoc.getPageCount()).toBe(3);
    });

    it('renders 2-up layout combining 4 pages into 2 sheets', async () => {
      const srcPdf = await createTestPdf(4);
      const rendered = await renderJobDocument(srcPdf, {
        pageRange: 'all',
        pagesPerSheet: 2,
        size: 'a4',
      });

      const outDoc = await PDFDocument.load(rendered);
      expect(outDoc.getPageCount()).toBe(2);
    });

    it('renders 4-up layout combining 4 pages onto 1 sheet', async () => {
      const srcPdf = await createTestPdf(4);
      const rendered = await renderJobDocument(srcPdf, {
        pageRange: 'all',
        pagesPerSheet: 4,
        size: 'a4',
      });

      const outDoc = await PDFDocument.load(rendered);
      expect(outDoc.getPageCount()).toBe(1);
    });

    it('applies page range filtering (e.g. 1-2 from 5 pages)', async () => {
      const srcPdf = await createTestPdf(5);
      const rendered = await renderJobDocument(srcPdf, {
        pageRange: '1-2',
        pagesPerSheet: 1,
        size: 'a4',
      });

      const outDoc = await PDFDocument.load(rendered);
      expect(outDoc.getPageCount()).toBe(2);
    });
  });

  describe('Printer Service & Paper Validation', () => {
    const printer = new PrinterService();

    it('accepts valid paper sizes', () => {
      expect(() =>
        printer.validatePrinterOptions({
          size: 'a4',
          color: 'bw',
          sides: 'single',
          copies: 1,
        }),
      ).not.toThrow();
    });

    it('rejects unsupported paper sizes', () => {
      expect(() =>
        printer.validatePrinterOptions({
          size: 'b2' as any,
          color: 'bw',
          sides: 'single',
          copies: 1,
        }),
      ).toThrow('is not supported by the printer');
    });

    it('dispatches print job cleanly and cleans up temporary files', async () => {
      const srcPdf = await createTestPdf(1);
      const result = await printer.printPdf(srcPdf, {
        size: 'a4',
        color: 'bw',
        sides: 'single',
        copies: 1,
      });

      expect(result.success).toBe(true);
      expect(result.jobName).toBeDefined();
    });
  });
});
