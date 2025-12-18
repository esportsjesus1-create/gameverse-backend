export enum ErrorCode {
  UNKNOWN = 1000,
  INVALID_MESSAGE = 1001,
  INVALID_PAYLOAD = 1002,
  AUTHENTICATION_REQUIRED = 1003,
  AUTHENTICATION_FAILED = 1004,
  SESSION_NOT_FOUND = 1005,
  SESSION_EXPIRED = 1006,
  CONNECTION_LIMIT_REACHED = 1007,
  HEARTBEAT_TIMEOUT = 1008,
  MESSAGE_TOO_LARGE = 1009,
  RATE_LIMIT_EXCEEDED = 1010,
  RPC_METHOD_NOT_FOUND = 2001,
  RPC_INVALID_PARAMS = 2002,
  RPC_EXECUTION_ERROR = 2003,
  RPC_TIMEOUT = 2004,
  STATE_NOT_FOUND = 3001,
  STATE_VERSION_CONFLICT = 3002,
  STATE_INVALID_OPERATION = 3003,
  ASSET_NOT_FOUND = 4001,
  ASSET_TRANSFER_ERROR = 4002,
  ASSET_CHECKSUM_MISMATCH = 4003,
  PLUGIN_INITIALIZATION_ERROR = 5001,
  PLUGIN_NOT_FOUND = 5002
}

export class UnrealBridgeError extends Error {
  public readonly code: ErrorCode;
  public readonly recoverable: boolean;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message: string,
    recoverable = true,
    details?: unknown
  ) {
    super(message);
    this.name = 'UnrealBridgeError';
    this.code = code;
    this.recoverable = recoverable;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      details: this.details
    };
  }
}

export class AuthenticationError extends UnrealBridgeError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.AUTHENTICATION_FAILED, message, true, details);
    this.name = 'AuthenticationError';
  }
}

export class SessionError extends UnrealBridgeError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, true, details);
    this.name = 'SessionError';
  }
}

export class RPCError extends UnrealBridgeError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, true, details);
    this.name = 'RPCError';
  }
}

export class StateError extends UnrealBridgeError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, true, details);
    this.name = 'StateError';
  }
}

export class AssetError extends UnrealBridgeError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, true, details);
    this.name = 'AssetError';
  }
}

export function isUnrealBridgeError(error: unknown): error is UnrealBridgeError {
  return error instanceof UnrealBridgeError;
}

export function createErrorPayload(error: UnrealBridgeError): {
  code: number;
  message: string;
  details?: unknown;
  recoverable: boolean;
} {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    recoverable: error.recoverable
  };
}
