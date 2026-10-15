import { Anchor, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

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
    const message = error instanceof Error ? error.message : 'Не удалось открыть файл';
    notifications.show({
      title: 'Не удалось открыть файл',
      message,
      color: 'red',
      autoClose: 8000,
    });
  }
}

/** Success toast after Word export: clickable file name opens the saved document. */
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
    autoClose: 12000,
  });
}
