import { Anchor, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { notifyError } from '@/application/errors/errorHandler';

async function openSavedFile(filePath: string): Promise<void> {
  try {
    const openPath = window.electronAPI?.shell?.openPath;
    if (!openPath) {
      throw new Error('Открытие файлов доступно только в Electron');
    }
    const errorMessage = await openPath(filePath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  } catch (error) {
    notifyError(error, { title: 'Не удалось открыть файл' });
  }
}

/** Success toast after export: clickable path, stays 5 seconds. */
export function notifyExportSaved(filePath: string, formatLabel: string): void {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  notifications.show({
    title: `${formatLabel} сохранён`,
    message: (
      <Stack gap={4}>
        <Text size="sm">Файл готов. Нажмите, чтобы открыть:</Text>
        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => {
            void openSavedFile(filePath);
          }}
          style={{
            textAlign: 'left',
            wordBreak: 'break-all',
            whiteSpace: 'normal',
          }}
        >
          {fileName}
        </Anchor>
        <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
          {filePath}
        </Text>
      </Stack>
    ),
    color: 'green',
    autoClose: 5000,
  });
}
