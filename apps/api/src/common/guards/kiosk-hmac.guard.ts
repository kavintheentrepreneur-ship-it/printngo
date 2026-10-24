import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

export interface AuthenticatedKiosk {
  id: string;
}

declare module 'express' {
  interface Request {
    kiosk?: AuthenticatedKiosk;
    rawBody?: Buffer;
  }
}

@Injectable()
export class KioskHmacGuard implements CanActivate {
  private readonly logger = new Logger(KioskHmacGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const kioskId = request.headers['x-kiosk-id'] as string;
    const timestampHeader = request.headers['x-kiosk-timestamp'] as string;
    const signature = request.headers['x-kiosk-signature'] as string;

    if (!kioskId || !timestampHeader || !signature) {
      throw new HttpException(
        {
          code: 'UNAUTHORIZED_KIOSK',
          message: 'Missing required kiosk authentication headers (X-Kiosk-Id, X-Kiosk-Timestamp, X-Kiosk-Signature).',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const requestTimestamp = parseInt(timestampHeader, 10);
    if (isNaN(requestTimestamp)) {
      throw new HttpException(
        {
          code: 'INVALID_TIMESTAMP',
          message: 'Invalid X-Kiosk-Timestamp header format.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Replay attack prevention: must be within 5 minutes (300 seconds)
    const currentEpochSeconds = Math.floor(Date.now() / 1000);
    const diffSeconds = Math.abs(currentEpochSeconds - requestTimestamp);
    if (diffSeconds > 300) {
      this.logger.warn(`Rejected replay request from kiosk ${kioskId}. Time delta: ${diffSeconds}s`);
      throw new HttpException(
        {
          code: 'REPLAY_ATTACK_DETECTED',
          message: 'Request timestamp is older than 5 minutes or in the future.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Lookup kiosk secret (from env or config)
    const configuredKioskId =
      this.configService?.get<string>('DEFAULT_KIOSK_ID') ||
      process.env.DEFAULT_KIOSK_ID ||
      'kiosk_dev_01';
    const configuredSecret =
      this.configService?.get<string>('DEFAULT_KIOSK_SECRET') ||
      process.env.DEFAULT_KIOSK_SECRET ||
      'kiosk_super_secret_hmac_key_32_chars';

    if (kioskId !== configuredKioskId) {
      throw new HttpException(
        {
          code: 'KIOSK_NOT_FOUND',
          message: 'Unknown kiosk identifier.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Canonical payload: METHOD:PATH:TIMESTAMP:BODY
    const bodyStr = request.body && Object.keys(request.body).length > 0
      ? JSON.stringify(request.body)
      : '';
    const path = request.originalUrl || request.url;
    const payload = `${request.method.toUpperCase()}:${path}:${requestTimestamp}:${bodyStr}`;

    const expectedSignature = crypto
      .createHmac('sha256', configuredSecret)
      .update(payload)
      .digest('hex');

    // Constant-time comparison
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      this.logger.warn(`Invalid HMAC signature for kiosk ${kioskId}`);
      throw new HttpException(
        {
          code: 'INVALID_SIGNATURE',
          message: 'Invalid kiosk request HMAC signature.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.kiosk = { id: kioskId };
    return true;
  }
}
