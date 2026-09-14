import { ActionIcon, Tooltip } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { useState, type MouseEvent } from 'react';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { copyImageDataUrlToClipboard } from '@/application/testCases/screenshotHelpers';

type CopyScreenshotButtonProps = {
  src: string;
  className?: string;
  variant?: 'subtle' | 'filled';
  color?: string;
  radius?: 'sm' | 'md' | 'xl';
};

export function CopyScreenshotButton({
  src,
  className,
  variant = 'subtle',
  color,
  radius,
}: CopyScreenshotButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!src || busy) {
      return;
    }

    setBusy(true);
    void copyImageDataUrlToClipboard(src)
      .then(() => {
        notifySuccess('Скриншот скопирован');
      })
      .catch((error: unknown) => {
        notifyError(error, { title: 'Не удалось скопировать' });
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <Tooltip label="Копировать">
      <ActionIcon
        className={className}
        size="sm"
        variant={variant}
        color={color}
        radius={radius}
        aria-label="Копировать скриншот"
        loading={busy}
        disabled={!src}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={handleClick}
      >
        <IconCopy size={14} />
      </ActionIcon>
    </Tooltip>
  );
}
