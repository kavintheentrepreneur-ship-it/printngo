import { Global, Module } from '@nestjs/common';
import { KioskGateway } from './kiosk.gateway';

@Global()
@Module({
  providers: [KioskGateway],
  exports: [KioskGateway],
})
export class RealtimeModule {}
