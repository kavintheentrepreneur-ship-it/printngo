import { Module } from '@nestjs/common';
import { ManualUpiPaymentProvider } from './manual-upi.provider';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RazorpayPaymentProvider } from './razorpay.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    RazorpayPaymentProvider,
    ManualUpiPaymentProvider,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
