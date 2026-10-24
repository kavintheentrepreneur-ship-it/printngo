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
  UseGuards,
} from '@nestjs/common';
import { UpdateJobOptionsInput } from '@printngo/shared';
import { SessionTokenGuard } from '../../common/guards/session-token.guard';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(SessionTokenGuard)
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobsService: JobsService) {}

  @Put(':id/options')
  async updateOptions(
    @Param('id') jobId: string,
    @Body() options: UpdateJobOptionsInput,
  ) {
    return this.jobsService.updateJobOptions(jobId, options);
  }

  @Get(':id/price')
  async getPrice(@Param('id') jobId: string) {
    return this.jobsService.getPrice(jobId);
  }

  @Post(':id/proceed')
  @HttpCode(HttpStatus.OK)
  async proceed(@Param('id') jobId: string) {
    return this.jobsService.proceedToPayment(jobId);
  }
}
