import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { TestCaseFormValues } from '@/application/testCases/testCaseActions';
import type { TestCase } from '@/domain/types';

type TestCaseFormModalProps = {
  opened: boolean;
  mode: 'create' | 'edit';
  initial?: TestCase | null;
  /** Prefill for create mode (sequential number). */
  suggestedNumber?: string;
  onClose: () => void;
  onSubmit: (values: TestCaseFormValues) => void;
};

function toFormValues(initial?: TestCase | null, suggestedNumber?: string): TestCaseFormValues {
  return {
    number: initial?.number ?? suggestedNumber ?? '1',
    title: initial?.title ?? '',
    section: '',
    module: '',
    author: '',
    developer: '',
    businessAnalyst: '',
    priority: 'medium',
    status: 'draft',
  };
}

export function TestCaseFormModal({
  opened,
  mode,
  initial,
  suggestedNumber,
  onClose,
  onSubmit,
}: TestCaseFormModalProps) {
  const [values, setValues] = useState<TestCaseFormValues>(
    toFormValues(initial, suggestedNumber),
  );

  useEffect(() => {
    if (opened) {
      setValues(toFormValues(initial, suggestedNumber));
    }
  }, [opened, initial, suggestedNumber]);

  const handleSubmit = () => {
    if (!values.number.trim()) {
      return;
    }
    onSubmit({
      ...values,
      title: values.title.trim(),
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'Создать тест-кейс' : 'Редактировать тест-кейс'}
      centered
      size="md"
    >
      <Stack gap="md">
        <TextInput
          label="Тест №"
          required
          value={values.number}
          onChange={(event) => {
            const value = event.currentTarget?.value ?? event.target?.value ?? '';
            setValues((prev) => ({ ...prev, number: value }));
          }}
          data-autofocus
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!values.number.trim()}>
            {mode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
