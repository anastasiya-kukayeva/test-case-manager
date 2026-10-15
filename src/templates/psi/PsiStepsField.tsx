import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { nanoid } from 'nanoid';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { createEmptyRichText } from '@/domain/factories/createEntities';
import type { PsiStep } from '@/domain/types';

type PsiStepsFieldProps = {
  value: PsiStep[];
  onChange: (value: PsiStep[]) => void;
};

export function PsiStepsField({ value, onChange }: PsiStepsFieldProps) {
  const addStep = () => {
    onChange([...value, { id: nanoid(), content: createEmptyRichText() }]);
  };

  const removeStep = (id: string) => {
    onChange(value.filter((step) => step.id !== id));
  };

  return (
    <Stack gap="md">
      {value.map((step, index) => (
        <Stack key={step.id} gap={6}>
          <Group justify="space-between">
            <Text fw={600}>{index + 1}.</Text>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Удалить шаг ${index + 1}`}
              onClick={() => removeStep(step.id)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
          <FormRichTextEditor
            value={step.content}
            onChange={(content) => {
              onChange(value.map((item) => (item.id === step.id ? { ...item, content } : item)));
            }}
            placeholder="Опишите шаг…"
            minHeight={120}
            allowImages
            allowCodeAndLogs
          />
        </Stack>
      ))}
      <Button
        variant="light"
        w="fit-content"
        leftSection={<IconPlus size={16} />}
        onClick={addStep}
      >
        Добавить шаг
      </Button>
    </Stack>
  );
}
