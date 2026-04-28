import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * Global exception filter — produces the unified error envelope:
 *
 *   {
 *     data: null,
 *     meta: {
 *       error: { statusCode, message, code?, errors?, path, method },
 *       requestId, timestamp, version
 *     }
 *   }
 *
 * Handles ZodError (422), NestJS HttpException, and any unknown Error.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'حدث خطأ غير متوقع';
    let code: string | undefined;
    let errors: Array<{ path: string[]; message: string }> | undefined;

    if (exception instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      message = 'بيانات غير صالحة';
      code = 'VALIDATION_ERROR';
      errors = exception.issues.map((i) => ({
        path: i.path.map(String),
        message: i.message,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r.message as string) ?? message;
        code = r.code as string | undefined;
        if (Array.isArray(r.errors)) {
          errors = r.errors as Array<{ path: string[]; message: string }>;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message = process.env.NODE_ENV === 'production' ? 'حدث خطأ غير متوقع' : exception.message;
    }

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? null;
    const version = process.env.APP_VERSION ?? '0.1.0';

    response.status(status).json({
      data: null,
      meta: {
        error: {
          statusCode: status,
          message,
          ...(code ? { code } : {}),
          ...(errors ? { errors } : {}),
          path: request.url,
          method: request.method,
        },
        requestId,
        timestamp: new Date().toISOString(),
        version,
      },
    });
  }
}
