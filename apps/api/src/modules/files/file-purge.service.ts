import { Inject, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class FilePurgeService {
  private readonly logger = new Logger(FilePurgeService.name);

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /**
   * Purges uploaded customer files older than 7 days to preserve privacy and storage integrity.
   */
  async purgeExpiredFiles(retentionDays = 7): Promise<{ purgedCount: number }> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const uploadsDir = path.resolve(process.cwd(), 'uploads');

    let purgedCount = 0;

    if (!fs.existsSync(uploadsDir)) {
      return { purgedCount: 0 };
    }

    const files = await fs.promises.readdir(uploadsDir);
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.mtime < cutoffDate) {
          await fs.promises.unlink(filePath);
          purgedCount++;
          await this.db.logEvent('customer_file_purged', { file, mtime: stats.mtime });
          this.logger.log(`Purged customer file ${file} (older than ${retentionDays} days)`);
        }
      } catch (err) {
        this.logger.warn(`Failed to inspect/purge file ${file}:`, err);
      }
    }

    return { purgedCount };
  }
}
