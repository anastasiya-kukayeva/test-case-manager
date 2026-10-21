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
import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import { IconGripVertical, IconPlus, IconTrash } from '@tabler/icons-react';
import { nanoid } from 'nanoid';
import type { CSSProperties } from 'react';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { createEmptyRichText } from '@/domain/factories/createEntities';
import type { PsiStep } from '@/domain/types';

type PsiStepsFieldProps = {
  value: PsiStep[];
  onChange: (value: PsiStep[]) => void;
};

function SortableStep({
  step,
  index,
  onChange,
  onRemove,
}: {
  step: PsiStep;
  index: number;
  onChange: (content: PsiStep['content']) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <Stack ref={setNodeRef} gap={6} style={style}>
      <Group justify="space-between">
        <Group gap={6}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Перетащить шаг ${index + 1}`}
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
          aria-label={`Удалить шаг ${index + 1}`}
          onClick={onRemove}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
      <FormRichTextEditor
        value={step.content}
        onChange={onChange}
        placeholder="Опишите шаг…"
        minHeight={120}
        allowImages
        allowCodeAndLogs
      />
    </Stack>
  );
}

export function PsiStepsField({ value, onChange }: PsiStepsFieldProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const addStep = () => {
    onChange([...value, { id: nanoid(), content: createEmptyRichText() }]);
  };

  const removeStep = (id: string) => {
    onChange(value.filter((step) => step.id !== id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = value.findIndex((step) => step.id === active.id);
    const newIndex = value.findIndex((step) => step.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onChange(arrayMove(value, oldIndex, newIndex));
  };

  return (
    <Stack gap="md">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={value.map((step) => step.id)}
          strategy={verticalListSortingStrategy}
        >
          {value.map((step, index) => (
            <SortableStep
              key={step.id}
              step={step}
              index={index}
              onChange={(content) => {
                onChange(value.map((item) => (item.id === step.id ? { ...item, content } : item)));
              }}
              onRemove={() => removeStep(step.id)}
            />
          ))}
        </SortableContext>
      </DndContext>
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
