import { ActionIcon, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { nanoid } from 'nanoid';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { createEmptyRichText } from '@/domain/factories/createEntities';
import type { PsiResultItem } from '@/domain/types';

type PsiResultsFieldProps = {
  value: PsiResultItem[];
  onChange: (value: PsiResultItem[]) => void;
  errors?: Array<{ expected?: { message?: string }; actual?: { message?: string } } | undefined>;
};

export function PsiResultsField({ value, onChange, errors }: PsiResultsFieldProps) {
  const addResult = () => {
    onChange([
      ...value,
      { id: nanoid(), expected: createEmptyRichText(), actual: createEmptyRichText() },
    ]);
  };

  const removeResult = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
  };

  return (
    <Stack gap="lg">
      {value.map((item, index) => (
        <Stack key={item.id} gap="sm">
          <Group justify="space-between">
            <Text fw={600}>{index + 1}.</Text>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Удалить результат ${index + 1}`}
              onClick={() => removeResult(item.id)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Ожидаемый результат
              </Text>
              <FormRichTextEditor
                value={item.expected}
                onChange={(expected) => {
                  onChange(value.map((row) => (row.id === item.id ? { ...row, expected } : row)));
                }}
                placeholder="Ожидаемый результат…"
                minHeight={140}
                allowImages
                allowCodeAndLogs
                error={errors?.[index]?.expected?.message}
              />
            </Stack>
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Фактический результат
              </Text>
              <FormRichTextEditor
                value={item.actual}
                onChange={(actual) => {
                  onChange(value.map((row) => (row.id === item.id ? { ...row, actual } : row)));
                }}
                placeholder="Фактический результат…"
                minHeight={140}
                allowImages
                allowCodeAndLogs
                error={errors?.[index]?.actual?.message}
              />
            </Stack>
          </SimpleGrid>
        </Stack>
      ))}
      <Button
        variant="light"
        w="fit-content"
        leftSection={<IconPlus size={16} />}
        onClick={addResult}
      >
        Добавить результат
      </Button>
    </Stack>
  );
}
