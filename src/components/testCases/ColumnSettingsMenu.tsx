import { Button, Checkbox, Group, Menu, Text } from '@mantine/core';
import { IconColumns, IconPinned, IconPinnedOff } from '@tabler/icons-react';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';

const COLUMN_LABELS: Record<string, string> = {
  number: 'ID',
  title: 'Название',
  createdAt: 'Дата создания',
  updatedAt: 'Дата изменения',
  testOutcome: 'Результат',
};

const TOGGLEABLE_COLUMNS = Object.keys(COLUMN_LABELS);

export function ColumnSettingsMenu() {
  const columnVisibility = useTestCaseTableStore((state) => state.columnVisibility);
  const setColumnVisibility = useTestCaseTableStore((state) => state.setColumnVisibility);
  const columnPinning = useTestCaseTableStore((state) => state.columnPinning);
  const setColumnPinning = useTestCaseTableStore((state) => state.setColumnPinning);

  const toggleVisibility = (columnId: string) => {
    setColumnVisibility({
      ...columnVisibility,
      [columnId]: !(columnVisibility[columnId] ?? true),
    });
  };

  const togglePinLeft = (columnId: string) => {
    const left = new Set(columnPinning.left);
    if (left.has(columnId)) {
      left.delete(columnId);
    } else {
      left.add(columnId);
    }
    setColumnPinning({
      ...columnPinning,
      left: Array.from(left),
    });
  };

  return (
    <Menu shadow="md" width={280} closeOnItemClick={false}>
      <Menu.Target>
        <Button variant="default" leftSection={<IconColumns size={16} />}>
          Столбцы
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Отображение</Menu.Label>
        {TOGGLEABLE_COLUMNS.map((columnId) => (
          <Menu.Item key={columnId} onClick={() => toggleVisibility(columnId)}>
            <Group justify="space-between" wrap="nowrap">
              <Checkbox
                checked={columnVisibility[columnId] !== false}
                onChange={() => toggleVisibility(columnId)}
                label={COLUMN_LABELS[columnId]}
                tabIndex={-1}
              />
            </Group>
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Label>Закрепление слева</Menu.Label>
        {TOGGLEABLE_COLUMNS.map((columnId) => {
          const pinned = columnPinning.left.includes(columnId);
          return (
            <Menu.Item
              key={`pin-${columnId}`}
              leftSection={pinned ? <IconPinned size={14} /> : <IconPinnedOff size={14} />}
              onClick={() => togglePinLeft(columnId)}
            >
              <Text size="sm">
                {COLUMN_LABELS[columnId]} {pinned ? '(закреплён)' : ''}
              </Text>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
