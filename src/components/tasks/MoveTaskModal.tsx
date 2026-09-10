import { Button, Group, Modal, Radio, ScrollArea, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { RecentTask } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import {
  buildTaskTree,
  canNestTask,
  flattenTaskTree,
} from '@/domain/utils/taskTree';

const ROOT_VALUE = '__root__';

type MoveTaskModalProps = {
  opened: boolean;
  task: RecentTask | null;
  tasks: RecentTask[];
  confirming?: boolean;
  onClose: () => void;
  onConfirm: (parentTaskId: string | null) => void;
};

export function MoveTaskModal({
  opened,
  task,
  tasks,
  confirming = false,
  onClose,
  onConfirm,
}: MoveTaskModalProps) {
  const options = useMemo(() => {
    if (!task) {
      return [];
    }

    const tree = buildTaskTree(tasks);
    const flat = flattenTaskTree(tree);

    return [
      {
        value: ROOT_VALUE,
        label: 'Верхний уровень',
        description: 'Задача останется в общем списке',
        disabled: false,
      },
      ...flat
        .filter((item) => item.task.id !== task.id)
        .map((item) => ({
          value: item.task.id,
          label: `${'— '.repeat(item.depth)}${getTaskShortLabel(item.task)}`,
          description: item.task.filePath,
          disabled: !canNestTask(tasks, task.id, item.task.id),
        })),
    ];
  }, [task, tasks]);

  const [selected, setSelected] = useState(ROOT_VALUE);

  useEffect(() => {
    if (!opened || !task) {
      return;
    }
    const currentParent = task.parentTaskId?.trim();
    setSelected(currentParent && options.some((item) => item.value === currentParent) ? currentParent : ROOT_VALUE);
  }, [opened, task, options]);

  const handleConfirm = () => {
    onConfirm(selected === ROOT_VALUE ? null : selected);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!confirming) {
          onClose();
        }
      }}
      title="Переместить задачу"
      centered
    >
      <Stack gap="md">
        {task ? (
          <Text size="sm" c="dimmed">
            Куда вложить «{getTaskShortLabel(task)}»? Выбранная задача станет родительской, а эта —
            её подзадачей.
          </Text>
        ) : null}

        <ScrollArea.Autosize mah={320} type="auto">
          <Radio.Group value={selected} onChange={setSelected}>
            <Stack gap="sm">
              {options.map((option) => (
                <Radio
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  description={option.description}
                  disabled={option.disabled}
                />
              ))}
            </Stack>
          </Radio.Group>
        </ScrollArea.Autosize>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={confirming}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} loading={confirming} disabled={!task}>
            Переместить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
