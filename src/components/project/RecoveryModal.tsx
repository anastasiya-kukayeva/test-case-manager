import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { projectActions } from '@/application/project/projectActions';
import type { RecoverySnapshot } from '@/infrastructure/project/recoveryService';

type RecoveryModalProps = {
  snapshot: RecoverySnapshot | null;
  opened: boolean;
  onResolved: () => void;
};

export function RecoveryModal({ snapshot, opened, onResolved }: RecoveryModalProps) {
  if (!snapshot) {
    return null;
  }

  const handleRestore = async () => {
    await projectActions.restoreFromRecovery(snapshot);
    onResolved();
  };

  const handleDiscard = async () => {
    await projectActions.discardRecovery();
    onResolved();
  };

  return (
    <Modal
      opened={opened}
      onClose={() => void handleDiscard()}
      title="Восстановление задачи"
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
    >
      <Stack gap="md">
        <Text size="sm">
          Обнаружены несохранённые данные после аварийного закрытия приложения.
        </Text>
        <Text size="sm">
          Задача: <strong>{snapshot.document.meta.name}</strong>
        </Text>
        <Text size="sm" c="dimmed">
          Снимок: {dayjs(snapshot.savedAt).format('DD.MM.YYYY HH:mm:ss')}
        </Text>
        {snapshot.originalFilePath ? (
          <Text size="xs" c="dimmed">
            Исходный файл: {snapshot.originalFilePath}
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            Задача ещё не была сохранена на диск.
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={() => void handleDiscard()}>
            Отклонить
          </Button>
          <Button onClick={() => void handleRestore()}>Восстановить</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
