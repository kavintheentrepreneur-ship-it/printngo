import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { JobStatus, PriceTableConfig } from '@printngo/shared';
import { StaffService } from './staff.service';

@Controller('staff')
export class StaffController {
  constructor(
    @Inject(StaffService) private readonly staffService: StaffService,
  ) {}

  @Get('jobs')
  async listJobs(
    @Query('status') status?: JobStatus,
    @Query('kioskId') kioskId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.staffService.listJobs({
      status,
      kioskId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('pricing')
  async getPricing() {
    return this.staffService.getPricing();
  }

  @Put('pricing')
  async updatePricing(@Body() newConfig: Partial<PriceTableConfig>) {
    return this.staffService.updatePricing(newConfig);
  }

  @Post('jobs/:id/reprint')
  @HttpCode(HttpStatus.OK)
  async reprintJob(@Param('id') jobId: string) {
    return this.staffService.reprintJob(jobId);
  }

  @Post('jobs/:id/refund')
  @HttpCode(HttpStatus.OK)
  async refundJob(@Param('id') jobId: string) {
    return this.staffService.refundJob(jobId);
  }

  @Get('logs')
  async getEventLogs(@Query('limit') limit?: string) {
    return this.staffService.getEventLogs(limit ? parseInt(limit, 10) : 100);
  }
}
