import { Module } from '@nestjs/common';
import { DocumentProcessorService } from '../../common/services/document-processor.service';
import { StorageService } from '../../common/services/storage.service';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [SessionsController],
  providers: [SessionsService, StorageService, DocumentProcessorService],
  exports: [SessionsService],
})
export class SessionsModule {}
