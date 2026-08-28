import { modals } from '@mantine/modals';
import { Text } from '@mantine/core';
import type { ReactNode } from 'react';

type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
};

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = 'Подтвердить',
    cancelLabel = 'Отмена',
    confirmColor = 'blue',
  } = options;

  return new Promise((resolve) => {
    modals.openConfirmModal({
      title,
      children: typeof message === 'string' ? <Text size="sm">{message}</Text> : message,
      labels: { confirm: confirmLabel, cancel: cancelLabel },
      confirmProps: { color: confirmColor },
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
