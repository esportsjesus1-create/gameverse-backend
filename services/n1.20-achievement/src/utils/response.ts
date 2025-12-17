import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    errors?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = StatusCodes.OK,
  meta?: ApiResponse['meta']
): void {
  const response: ApiResponse<T> = {
    success: true,
    data
  };

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, StatusCodes.CREATED);
}

export function sendNoContent(res: Response): void {
  res.status(StatusCodes.NO_CONTENT).send();
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  errors?: Record<string, string[]>
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (errors) {
    response.error!.errors = errors;
  }

  res.status(statusCode).json(response);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number
): void {
  const totalPages = Math.ceil(total / limit);

  sendSuccess(res, data, StatusCodes.OK, {
    page,
    limit,
    total,
    totalPages
  });
}
