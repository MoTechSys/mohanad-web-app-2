import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = 'حدث خطأ غير متوقع';
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
      message =
        process.env.NODE_ENV === 'production' ? 'حدث خطأ غير متوقع' : exception.message;
    }

    const requestId = (request.headers['x-request-id'] as string) ?? undefined;

    response.status(status).json({
      statusCode: status,
      message,
      code,
      errors,
      path: request.url,
      method: request.method,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
