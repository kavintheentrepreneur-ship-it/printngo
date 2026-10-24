import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { FilePurgeService } from '../files/file-purge.service';

@Module({
  controllers: [StaffController],
  providers: [StaffService, FilePurgeService],
  exports: [StaffService, FilePurgeService],
})
export class StaffModule implements OnModuleInit {
  constructor(
    @Inject(FilePurgeService) private readonly filePurgeService: FilePurgeService,
  ) {}

  onModuleInit(): void {
    // Run an initial file purge check on startup for files older than 7 days
    this.filePurgeService.purgeExpiredFiles(7).catch(() => {});

    // Schedule daily purge (every 24 hours)
    setInterval(() => {
      this.filePurgeService.purgeExpiredFiles(7).catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }
}
