import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionTokenGuard } from '../../common/guards/session-token.guard';
import { PaymentsService } from './payments.service';

class ConfirmPaymentDto {
  amountPaise!: number;
  staffEmail?: string;
}

@Controller()
export class PaymentsController {
  constructor(
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService,
  ) {}

  @Post('jobs/:id/payment-links')
  @UseGuards(SessionTokenGuard)
  async getPaymentLinks(@Param('id') jobId: string) {
    return this.paymentsService.getPaymentLinks(jobId);
  }

  @Get('jobs/:id/payment-status')
  @UseGuards(SessionTokenGuard)
  async getPaymentStatus(@Param('id') jobId: string) {
    return this.paymentsService.getPaymentStatus(jobId);
  }

  @Post('webhooks/razorpay')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    // If rawBody is available use it, otherwise JSON stringify
    const payload = req.rawBody ? req.rawBody : JSON.stringify(body);
    return this.paymentsService.handleRazorpayWebhook(payload, signature);
  }

  @Post('staff/payments/:jobId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPaymentByStaff(
    @Param('jobId') jobId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.paymentsService.confirmPaymentByStaff(
      jobId,
      dto.staffEmail || 'staff_operator@printngo.local',
      dto.amountPaise,
    );
  }
}
