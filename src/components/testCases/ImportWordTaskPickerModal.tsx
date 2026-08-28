import { Button, Modal, Radio, ScrollArea, Stack, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { WordImportTaskTarget } from '@/application/import/wordImportActions';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import type { RecentTask } from '@/domain/types';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

type ImportWordTaskPickerModalProps = {
  opened: boolean;
  onClose: () => void;
  onConfirm: (target: WordImportTaskTarget) => void;
  confirming?: boolean;
};

const CURRENT_VALUE = '__current__';

export function ImportWordTaskPickerModal({
  opened,
  onClose,
  onConfirm,
  confirming = false,
}: ImportWordTaskPickerModalProps) {
  const current = useProjectStore((state) => state.current);
  const recentProjects = useAppStore((state) => state.recentProjects) as RecentTask[];

  const options = useMemo(() => {
    const items: Array<{ value: string; label: string; description?: string }> = [];

    if (current) {
      items.push({
        value: CURRENT_VALUE,
        label: getTaskShortLabel(current.document.meta),
        description: current.filePath
          ? 'Открытая задача'
          : 'Открытая задача (ещё не сохранена на диск)',
      });
    }

    for (const recent of recentProjects) {
      if (recent.filePath.startsWith('__unsaved__')) {
        continue;
      }
      const isCurrentFile =
        Boolean(current?.filePath) && current?.filePath === recent.filePath;
      const isCurrentId = Boolean(current) && current?.document.meta.id === recent.id;
      if (isCurrentFile || isCurrentId) {
        continue;
      }
      items.push({
        value: recent.filePath,
        label: getTaskShortLabel(recent),
        description: recent.filePath,
      });
    }

    return items;
  }, [current, recentProjects]);

  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      return;
    }
    setSelected(options[0]?.value ?? null);
  }, [opened, options]);

  const handleConfirm = () => {
    if (!selected) {
      return;
    }
    if (selected === CURRENT_VALUE) {
      onConfirm({ type: 'current' });
      return;
    }
    const option = options.find((item) => item.value === selected);
    onConfirm({
      type: 'file',
      filePath: selected,
      label: option?.label ?? selected,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!confirming) {
          onClose();
        }
      }}
      title="Куда импортировать тест-кейсы?"
      centered
    >
      <Stack gap="md">
        {options.length === 0 ? (
          <Text size="sm" c="dimmed">
            Нет доступных задач. Создайте или откройте задачу, затем повторите импорт.
          </Text>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Выберите задачу — тест-кейсы из Word будут добавлены в конец её списка.
            </Text>
            <ScrollArea.Autosize mah={320} type="auto">
              <Radio.Group value={selected ?? undefined} onChange={setSelected}>
                <Stack gap="sm">
                  {options.map((option) => (
                    <Radio
                      key={option.value}
                      value={option.value}
                      label={option.label}
                      description={option.description}
                    />
                  ))}
                </Stack>
              </Radio.Group>
            </ScrollArea.Autosize>
          </>
        )}

        <Button
          fullWidth
          disabled={!selected || options.length === 0}
          loading={confirming}
          onClick={handleConfirm}
        >
          Выбрать файл Word…
        </Button>
      </Stack>
    </Modal>
  );
}
