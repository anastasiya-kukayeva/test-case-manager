import { AppError } from '@/application/errors/AppError';

export type NotifyErrorOptions = {
  title?: string;
  showNotification?: boolean;
  logToConsole?: boolean;
};

export function getErrorMessage(error: unknown): string {
  return AppError.fromUnknown(error).message;
}

/** Failures are logged only. Success and error toasts are not shown. */
export function notifyError(error: unknown, options: NotifyErrorOptions = {}): AppError {
  const appError = AppError.fromUnknown(error);
  const { logToConsole = true } = options;

  if (logToConsole) {
    console.error(`[${appError.code}] ${appError.message}`, appError.details ?? appError.cause ?? '');
  }

  return appError;
}

export function notifySuccess(_message: string, _title = 'Успешно'): void {}

export function notifyInfo(_message: string, _title = 'Информация'): void {}

export function notifyWarning(_message: string, _title = 'Внимание'): void {}
