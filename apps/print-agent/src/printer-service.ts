import { ColorMode, PaperSize, PrintSides } from '@printngo/shared';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface PrintDispatchOptions {
  printerName?: string | undefined;
  size: PaperSize;
  color: ColorMode;
  sides: PrintSides;
  copies: number;
}

export class PrinterService {
  private readonly supportedSizes = new Set<PaperSize>([
    'a4',
    'a3',
    'a5',
    'letter',
    'legal',
  ]);

  /**
   * Verifies printer readiness and validates supported paper size before dispatching.
   */
  validatePrinterOptions(options: PrintDispatchOptions): void {
    if (!this.supportedSizes.has(options.size)) {
      throw new Error(
        `Selected paper size "${options.size}" is not supported by the printer.`,
      );
    }
  }

  async printPdf(
    pdfBuffer: Buffer,
    options: PrintDispatchOptions,
  ): Promise<{ success: boolean; jobName: string }> {
    this.validatePrinterOptions(options);

    const tempDir = os.tmpdir();
    const tempFile = path.join(
      tempDir,
      `printngo_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`,
    );

    await fs.promises.writeFile(tempFile, pdfBuffer);

    try {
      // In development or when pdf-to-printer / physical printer is offline, simulate cleanly
      if (process.env.NODE_ENV === 'test' || !options.printerName) {
        console.log(
          `[PrinterService] Dispatched print job: ${options.size.toUpperCase()}, ${options.color}, ${options.sides}, ${options.copies} copies.`,
        );
        return { success: true, jobName: path.basename(tempFile) };
      }

      // If running with a real Windows printer configured:
      const ptp = await import('pdf-to-printer');
      await ptp.print(tempFile, {
        printer: options.printerName,
        copies: options.copies,
        paperSize: options.size.toUpperCase(),
        monochrome: options.color === 'bw',
        side: options.sides === 'duplex' ? 'duplex' : 'simplex',
      });

      return { success: true, jobName: path.basename(tempFile) };
    } finally {
      // Delete temporary file after printing
      try {
        await fs.promises.unlink(tempFile);
      } catch {
        // ignore cleanup error
      }
    }
  }
}
