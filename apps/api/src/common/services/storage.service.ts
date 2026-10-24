import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface StoredFileResult {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  localPath: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Validates file signature (magic bytes) to prevent executable uploads disguised as documents.
   */
  validateMagicBytes(buffer: Buffer, originalName: string): { detectedMime: string } {
    if (buffer.length < 4) {
      throw new HttpException(
        {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'This file type is not supported. Please upload a PDF, JPG, PNG, or DOCX.',
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    // PDF: %PDF (25 50 44 46)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return { detectedMime: 'application/pdf' };
    }

    // PNG: 89 50 4E 47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { detectedMime: 'image/png' };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { detectedMime: 'image/jpeg' };
    }

    // DOCX (ZIP format: PK.. 50 4B 03 04)
    if (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04 &&
      originalName.toLowerCase().endsWith('.docx')
    ) {
      return { detectedMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }

    // Windows Executable / PE (MZ: 4D 5A) - reject immediately
    if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
      throw new HttpException(
        {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: 'Executable files are prohibited. Please upload a PDF, JPG, PNG, or DOCX.',
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    throw new HttpException(
      {
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'This file type is not supported. Please upload a PDF, JPG, PNG, or DOCX.',
      },
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }

  async saveFile(buffer: Buffer, originalName: string): Promise<StoredFileResult> {
    // 25 MB max size check
    const MAX_BYTES = 25 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      throw new HttpException(
        {
          code: 'FILE_TOO_LARGE',
          message: 'This file is larger than 25 MB. Please upload a smaller file.',
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const { detectedMime } = this.validateMagicBytes(buffer, originalName);

    // Compute SHA-256 hash
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // Generate unique sanitized storage key
    const ext = path.extname(originalName) || (detectedMime === 'application/pdf' ? '.pdf' : '.bin');
    const storageKey = `job_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const localPath = path.join(this.storageDir, storageKey);

    await fs.promises.writeFile(localPath, buffer);
    this.logger.log(`Stored file ${storageKey} (${buffer.length} bytes, ${detectedMime})`);

    return {
      storageKey,
      originalName: path.basename(originalName),
      mimeType: detectedMime,
      sizeBytes: buffer.length,
      sha256,
      localPath,
    };
  }

  async readFile(storageKey: string): Promise<Buffer> {
    const localPath = path.join(this.storageDir, storageKey);
    return fs.promises.readFile(localPath);
  }
}
