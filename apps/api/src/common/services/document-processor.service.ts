import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  async countPages(buffer: Buffer, mimeType: string): Promise<number> {
    if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      return 1;
    }

    if (mimeType === 'application/pdf') {
      try {
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
        const count = pdfDoc.getPageCount();
        if (count <= 0) return 1;
        return count;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : '';
        if (
          errorMsg.toLowerCase().includes('encrypt') ||
          errorMsg.toLowerCase().includes('password')
        ) {
          throw new HttpException(
            {
              code: 'ENCRYPTED_PDF',
              message: 'This PDF is password protected. Please remove the password and upload again.',
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        this.logger.warn(`PDF parse error: ${errorMsg}`);
        throw new HttpException(
          {
            code: 'INVALID_PDF',
            message: 'Unable to parse the PDF document. Please verify the file is not corrupted.',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // DOCX or other supported formats: default 1 page minimum
    return 1;
  }
}
