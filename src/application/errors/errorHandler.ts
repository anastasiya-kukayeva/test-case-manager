import { notifications } from '@mantine/notifications';
import { AppError } from '@/application/errors/AppError';

export type NotifyErrorOptions = {
  title?: string;
  showNotification?: boolean;
  logToConsole?: boolean;
};

export function getErrorMessage(error: unknown): string {
  return AppError.fromUnknown(error).message;
}

export function notifyError(error: unknown, options: NotifyErrorOptions = {}): AppError {
  const appError = AppError.fromUnknown(error);
  const {
    title = 'Ошибка',
    showNotification = true,
    logToConsole = true,
  } = options;

  if (logToConsole) {
    console.error(`[${appError.code}] ${appError.message}`, appError.details ?? appError.cause ?? '');
  }

  if (showNotification) {
    notifications.show({
      title,
      message: appError.message,
      color: 'red',
      autoClose: 8000,
    });
  }

  return appError;
}

export function notifySuccess(message: string, title = 'Успешно'): void {
  notifications.show({
    title,
    message,
    color: 'green',
    autoClose: 3000,
  });
}

export function notifyInfo(message: string, title = 'Информация'): void {
  notifications.show({
    title,
    message,
    color: 'blue',
    autoClose: 3000,
  });
}

export function notifyWarning(message: string, title = 'Внимание'): void {
  notifications.show({
    title,
    message,
    color: 'orange',
    autoClose: 4500,
  });
}
