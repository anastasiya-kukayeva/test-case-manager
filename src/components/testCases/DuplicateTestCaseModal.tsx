import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

type DuplicateTestCaseModalProps = {
  opened: boolean;
  sourceNumber?: string;
  sourceLabel?: string;
  suggestedNumber: string;
  onClose: () => void;
  onConfirm: (number: string) => void;
};

export function DuplicateTestCaseModal({
  opened,
  sourceNumber,
  sourceLabel,
  suggestedNumber,
  onClose,
  onConfirm,
}: DuplicateTestCaseModalProps) {
  const [number, setNumber] = useState(suggestedNumber);

  useEffect(() => {
    if (opened) {
      setNumber(suggestedNumber);
    }
  }, [opened, suggestedNumber]);

  const handleSubmit = () => {
    if (!number.trim()) {
      return;
    }
    onConfirm(number.trim());
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Копировать тест-кейс" centered size="md">
      <Stack gap="md">
        {sourceNumber || sourceLabel ? (
          <Text size="sm" c="dimmed">
            Копия тест-кейса
            {sourceNumber ? ` №${sourceNumber}` : ''}
            {sourceLabel ? `: ${sourceLabel}` : ''}
          </Text>
        ) : null}

        <TextInput
          label="Номер нового тест-кейса"
          description="Предложен следующий номер после последнего в задаче"
          required
          value={number}
          onChange={(event) => {
            setNumber(event.currentTarget?.value ?? event.target?.value ?? '');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }
          }}
          data-autofocus
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!number.trim()}>
            Создать копию
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
