import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly sessionLimits = new Map<string, Bucket>();
  private readonly kioskLimits = new Map<string, Bucket>();
  private readonly ipLimits = new Map<string, Bucket>();

  use(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const sessionToken = req.headers['x-session-token'] as string | undefined;
    const kioskId = req.headers['x-kiosk-id'] as string | undefined;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    // 1. Session Rate Limit: 60 req / min
    if (sessionToken) {
      if (this.isExceeded(this.sessionLimits, sessionToken, 60, 60000, now)) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Session rate limit exceeded. Max 60 requests per minute.',
          },
        });
        return;
      }
    }

    // 2. Kiosk Rate Limit: 300 req / min
    if (kioskId) {
      if (this.isExceeded(this.kioskLimits, kioskId, 300, 60000, now)) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Kiosk rate limit exceeded. Max 300 requests per minute.',
          },
        });
        return;
      }
    }

    // 3. Login / Auth Rate Limit: 10 req / min per IP
    if (req.path.includes('/login') || req.path.includes('/auth')) {
      if (this.isExceeded(this.ipLimits, ip, 10, 60000, now)) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Login rate limit exceeded. Max 10 attempts per minute.',
          },
        });
        return;
      }
    }

    next();
  }

  private isExceeded(
    store: Map<string, Bucket>,
    key: string,
    maxLimit: number,
    windowMs: number,
    now: number,
  ): boolean {
    const bucket = store.get(key);
    if (!bucket || now > bucket.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }

    bucket.count += 1;
    if (bucket.count > maxLimit) {
      return true;
    }
    return false;
  }
}
