import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterMiddleware } from './common/middleware/rate-limiter.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';
import { DatabaseModule } from './modules/database/database.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { KioskModule } from './modules/kiosk/kiosk.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StaffModule } from './modules/staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    RealtimeModule,
    KioskModule,
    SessionsModule,
    JobsModule,
    PaymentsModule,
    StaffModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(SecurityHeadersMiddleware, RateLimiterMiddleware)
      .forRoutes('*');
  }
}
