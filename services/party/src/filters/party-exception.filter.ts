import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PartyException, PartyExceptionResponse, PartyErrorCode } from '../exceptions';

@Catch()
export class PartyExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PartyExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: PartyExceptionResponse;

    if (exception instanceof PartyException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as PartyExceptionResponse;
      errorResponse = {
        ...exceptionResponse,
        path: request.url,
      };

      this.logger.warn(
        `Party Exception: ${errorResponse.errorCode} - ${errorResponse.message}`,
        {
          errorCode: errorResponse.errorCode,
          path: request.url,
          method: request.method,
          details: errorResponse.details,
        },
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as Record<string, unknown>).message || 'An error occurred';

      errorResponse = {
        statusCode: status,
        errorCode: PartyErrorCode.INTERNAL_ERROR,
        message: Array.isArray(message) ? message.join(', ') : String(message),
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      this.logger.warn(
        `HTTP Exception: ${status} - ${errorResponse.message}`,
        {
          path: request.url,
          method: request.method,
        },
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage = exception instanceof Error ? exception.message : 'Internal server error';

      errorResponse = {
        statusCode: status,
        errorCode: PartyErrorCode.INTERNAL_ERROR,
        message: errorMessage,
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      this.logger.error(
        `Unhandled Exception: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
        {
          path: request.url,
          method: request.method,
        },
      );
    }

    response.status(status).json(errorResponse);
  }
}
