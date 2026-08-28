export type AppErrorCode =
  | 'UNKNOWN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'STORAGE_READ'
  | 'STORAGE_WRITE'
  | 'PROJECT_INVALID'
  | 'IPC_UNAVAILABLE'
  | 'USER_CANCELLED';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, options?: { details?: unknown; cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = options?.details;
    this.cause = options?.cause;
  }

  static fromUnknown(error: unknown, fallbackMessage = 'Произошла неизвестная ошибка'): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError('UNKNOWN', error.message || fallbackMessage, { cause: error });
    }

    return new AppError('UNKNOWN', fallbackMessage, { details: error });
  }
}
