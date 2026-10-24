import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';
import { DatabaseService } from '../../modules/database/database.service';

export interface AuthenticatedSession {
  id: string;
  token: string;
  kioskId: string;
  status: string;
  expiresAt: Date;
}

declare module 'express' {
  interface Request {
    sessionData?: AuthenticatedSession;
  }
}

@Injectable()
export class SessionTokenGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check header or route param
    const token =
      (request.headers['x-session-token'] as string) ||
      (request.params['token'] as string);

    if (!token) {
      throw new HttpException(
        {
          code: 'UNAUTHORIZED_SESSION',
          message: 'Missing customer session token.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = await this.db.findSessionByTokenHash(tokenHash);

    if (!session) {
      throw new HttpException(
        {
          code: 'SESSION_NOT_FOUND',
          message: 'Invalid session token. Please scan the QR code again.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      session.status === 'expired' ||
      session.status === 'cancelled' ||
      session.status === 'completed' ||
      new Date() > new Date(session.expiresAt)
    ) {
      if (session.status !== 'expired' && session.status !== 'completed' && session.status !== 'cancelled') {
        await this.db.updateSessionStatus(session.id, 'expired');
      }
      throw new HttpException(
        {
          code: 'SESSION_EXPIRED',
          message: 'This kiosk session has ended. Please scan the new QR code on the screen.',
        },
        HttpStatus.GONE, // 410
      );
    }

    request.sessionData = session;
    return true;
  }
}
