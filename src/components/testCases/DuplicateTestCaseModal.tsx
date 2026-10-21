import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  copyTargetLabel,
  listCopyTargetTasks,
  type CopyTargetTask,
} from '@/application/testCases/listCopyTargetTasks';

type DuplicateTestCaseModalProps = {
  opened: boolean;
  sourceNumber?: string;
  sourceLabel?: string;
  onClose: () => void;
  onConfirm: (target: CopyTargetTask) => void | Promise<void>;
};

export function DuplicateTestCaseModal({
  opened,
  sourceNumber,
  sourceLabel,
  onClose,
  onConfirm,
}: DuplicateTestCaseModalProps) {
  const [tasks, setTasks] = useState<CopyTargetTask[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) {
      setSubmitting(false);
      return;
    }
    const next = listCopyTargetTasks();
    setTasks(next);
    setSelected(next.find((task) => task.current)?.value ?? null);
  }, [opened]);

  const selectedTask = tasks.find((task) => task.value === selected) ?? null;

  const handleSubmit = () => {
    if (!selectedTask || submitting) {
      return;
    }
    setSubmitting(true);
    void Promise.resolve(onConfirm(selectedTask)).finally(() => {
      setSubmitting(false);
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Копировать тест-кейс" centered size="lg">
      <Stack gap="md">
        {sourceNumber || sourceLabel ? (
          <Text size="sm" c="dimmed">
            Копия тест-кейса
            {sourceNumber ? ` №${sourceNumber}` : ''}
            {sourceLabel ? `: ${sourceLabel}` : ''}
          </Text>
        ) : null}

        <Select
          label="Задача"
          description="Копия добавляется в конец списка выбранной задачи"
          placeholder={tasks.length === 0 ? 'Нет сохранённых задач' : 'Выберите задачу'}
          data={tasks.map((task) => ({
            value: task.value,
            label: copyTargetLabel(task),
          }))}
          value={selected}
          onChange={setSelected}
          searchable
          allowDeselect={false}
          nothingFoundMessage="Ничего не найдено"
          disabled={tasks.length === 0 || submitting}
          data-autofocus
          comboboxProps={{ withinPortal: true }}
          filter={({ options, search, limit }) => {
            const needle = search.trim().toLocaleLowerCase('ru');
            const matched = options.filter((option) => {
              if (!('label' in option) || typeof option.label !== 'string') {
                return false;
              }
              if (!needle) {
                return true;
              }
              return option.label.toLocaleLowerCase('ru').includes(needle);
            });
            return matched.slice(0, limit);
          }}
          renderOption={({ option }) => {
            const task = tasks.find((item) => item.value === option.value);
            if (!task) {
              return option.label;
            }
            const showFull = task.fullName.trim() && task.fullName.trim() !== task.shortLabel;
            return (
              <Stack gap={0}>
                <Text size="sm">
                  {task.shortLabel}
                  {task.current ? ' (текущая)' : ''}
                </Text>
                {showFull ? (
                  <Text size="xs" c="dimmed">
                    {task.fullName}
                  </Text>
                ) : null}
              </Stack>
            );
          }}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedTask} loading={submitting}>
            Создать копию
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
