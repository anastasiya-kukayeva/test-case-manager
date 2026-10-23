import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionIcon, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { nanoid } from 'nanoid';
import type { CSSProperties } from 'react';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { createEmptyRichText } from '@/domain/factories/createEntities';
import type { PsiResultItem } from '@/domain/types';

type PsiResultsFieldProps = {
  value: PsiResultItem[];
  onChange: (value: PsiResultItem[]) => void;
  errors?: Array<{ expected?: { message?: string }; actual?: { message?: string } } | undefined>;
};

function SortableResult({
  item,
  index,
  error,
  onExpectedChange,
  onActualChange,
  onRemove,
}: {
  item: PsiResultItem;
  index: number;
  error?: { expected?: { message?: string }; actual?: { message?: string } };
  onExpectedChange: (expected: PsiResultItem['expected']) => void;
  onActualChange: (actual: PsiResultItem['actual']) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <Stack ref={setNodeRef} gap="sm" style={style}>
      <Group justify="space-between">
        <Group gap={6}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Перетащить результат ${index + 1}`}
            style={{ cursor: 'grab' }}
            {...attributes}
            {...listeners}
          >
            <IconGripVertical size={16} />
          </ActionIcon>
          <Text fw={600}>{index + 1}.</Text>
        </Group>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label={`Удалить результат ${index + 1}`}
          onClick={onRemove}
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
            onChange={onExpectedChange}
            placeholder="Ожидаемый результат…"
            minHeight={140}
            allowImages
            allowCodeAndLogs
            error={error?.expected?.message}
          />
        </Stack>
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Фактический результат
          </Text>
          <FormRichTextEditor
            value={item.actual}
            onChange={onActualChange}
            placeholder="Фактический результат…"
            minHeight={140}
            allowImages
            allowCodeAndLogs
            error={error?.actual?.message}
          />
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

export function PsiResultsField({ value, onChange, errors }: PsiResultsFieldProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const addResult = () => {
    onChange([
      ...value,
      { id: nanoid(), expected: createEmptyRichText(), actual: createEmptyRichText() },
    ]);
  };

  const removeResult = (id: string) => {
    onChange(value.filter((item) => item.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = value.findIndex((item) => item.id === active.id);
    const newIndex = value.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onChange(arrayMove(value, oldIndex, newIndex));
  };

  return (
    <Stack gap="lg">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={value.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {value.map((item, index) => (
            <SortableResult
              key={item.id}
              item={item}
              index={index}
              error={errors?.[index]}
              onExpectedChange={(expected) => {
                onChange(value.map((row) => (row.id === item.id ? { ...row, expected } : row)));
              }}
              onActualChange={(actual) => {
                onChange(value.map((row) => (row.id === item.id ? { ...row, actual } : row)));
              }}
              onRemove={() => removeResult(item.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
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
