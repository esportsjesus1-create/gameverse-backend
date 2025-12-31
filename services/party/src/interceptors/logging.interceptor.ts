import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

export interface RequestWithCorrelationId extends Request {
  correlationId?: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<RequestWithCorrelationId>();
    const response = ctx.getResponse<Response>();

    const correlationId = request.headers['x-correlation-id'] as string || uuidv4();
    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const { method, url, body, query, params } = request;
    const userAgent = request.get('user-agent') || '';
    const userId = (request as unknown as { user?: { id: string } }).user?.id || 'anonymous';

    const startTime = Date.now();

    this.logger.log({
      message: 'Incoming request',
      correlationId,
      method,
      url,
      userId,
      userAgent,
      query: Object.keys(query).length > 0 ? query : undefined,
      params: Object.keys(params).length > 0 ? params : undefined,
      bodySize: body ? JSON.stringify(body).length : 0,
    });

    return next.handle().pipe(
      tap((responseBody) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        this.logger.log({
          message: 'Request completed',
          correlationId,
          method,
          url,
          statusCode,
          duration: `${duration}ms`,
          userId,
          responseSize: responseBody ? JSON.stringify(responseBody).length : 0,
        });

        if (duration > 1000) {
          this.logger.warn({
            message: 'Slow request detected',
            correlationId,
            method,
            url,
            duration: `${duration}ms`,
            threshold: '1000ms',
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        this.logger.error({
          message: 'Request failed',
          correlationId,
          method,
          url,
          duration: `${duration}ms`,
          userId,
          error: error.message,
          errorCode: error.errorCode,
          stack: error.stack,
        });

        throw error;
      }),
    );
  }
}
