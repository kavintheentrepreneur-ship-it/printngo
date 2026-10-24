import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JobStatus } from '@printngo/shared';
import { KioskHmacGuard } from '../../common/guards/kiosk-hmac.guard';
import { KioskService } from './kiosk.service';

class UpdateJobStatusDto {
  status!: JobStatus;
  reason?: string;
}

@Controller('kiosk')
@UseGuards(KioskHmacGuard)
export class KioskController {
  constructor(@Inject(KioskService) private readonly kioskService: KioskService) {}

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Headers('x-kiosk-id') kioskId: string) {
    return this.kioskService.createSession(kioskId);
  }

  @Post('sessions/:id/close')
  @HttpCode(HttpStatus.OK)
  async closeSession(
    @Param('id') sessionId: string,
    @Headers('x-kiosk-id') kioskId: string,
  ) {
    return this.kioskService.closeSession(sessionId, kioskId);
  }

  @Get('jobs')
  async getJobs(@Headers('x-kiosk-id') kioskId: string) {
    return this.kioskService.getKioskJobs(kioskId);
  }

  @Patch('jobs/:id/status')
  async updateJobStatus(
    @Param('id') jobId: string,
    @Headers('x-kiosk-id') kioskId: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.kioskService.updateJobStatusByPrintAgent(
      jobId,
      kioskId,
      dto.status,
      dto.reason,
    );
  }
}
