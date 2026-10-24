import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred. Please try again or contact staff.';
    let field: string | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj['message'] as string) || exception.message;
        code = (resObj['code'] as string) || this.getDefaultCodeForStatus(status);
        field = resObj['field'] as string | undefined;

        if (Array.isArray(resObj['message'])) {
          message = resObj['message'].join('; ');
          code = 'VALIDATION_FAILED';
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      message = exception.message;
      if ('code' in exception && typeof (exception as { code: unknown }).code === 'string') {
        code = (exception as { code: string }).code;
      }
      if ('status' in exception && typeof (exception as { status: unknown }).status === 'number') {
        status = (exception as { status: number }).status;
      }
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(field ? { field } : {}),
      },
    });
  }

  private getDefaultCodeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'INVALID_STATE_TRANSITION';
      case 410:
        return 'SESSION_EXPIRED';
      case 413:
        return 'FILE_TOO_LARGE';
      case 415:
        return 'UNSUPPORTED_FILE_TYPE';
      case 422:
        return 'UNPROCESSABLE_ENTITY';
      default:
        return 'API_ERROR';
    }
  }
}
