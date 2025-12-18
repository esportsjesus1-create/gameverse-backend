export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message, 400);
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class StreamError extends AppError {
  public readonly streamId?: string;

  constructor(message: string, streamId?: string) {
    super(message, 500);
    this.streamId = streamId;
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}

export class WebRTCError extends AppError {
  constructor(message: string) {
    super(message, 500);
    Object.setPrototypeOf(this, WebRTCError.prototype);
  }
}

export class RecordingError extends AppError {
  public readonly recordingId?: string;

  constructor(message: string, recordingId?: string) {
    super(message, 500);
    this.recordingId = recordingId;
    Object.setPrototypeOf(this, RecordingError.prototype);
  }
}

export class BandwidthError extends AppError {
  constructor(message: string) {
    super(message, 503);
    Object.setPrototypeOf(this, BandwidthError.prototype);
  }
}
