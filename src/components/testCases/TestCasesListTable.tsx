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
import { ActionIcon, Box, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconCopy, IconEdit, IconGripVertical, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import type { CSSProperties } from 'react';
import { TestOutcomeControl } from '@/components/testCases/TestOutcomeControl';
import type { TestCase, TestResultOutcome } from '@/domain/types';
import '@/components/testCases/testCasesTable.css';

export type TestCasesListRow = Pick<
  TestCase,
  'id' | 'number' | 'title' | 'goal' | 'createdAt' | 'updatedAt' | 'testOutcome'
>;

type TestCasesListTableProps = {
  rows: TestCasesListRow[];
  onOpen: (row: TestCasesListRow) => void;
  onDelete?: (row: TestCasesListRow) => void;
  onDuplicate?: (row: TestCasesListRow) => void;
  onOutcomeChange?: (row: TestCasesListRow, outcome: TestResultOutcome) => void;
  /** When set, rows become draggable; called with ids in the new visual order. */
  onReorder?: (orderedIds: string[]) => void;
  openingId?: string | null;
  deletingId?: string | null;
  duplicatingId?: string | null;
  emptyText?: string;
  rowKeyPrefix?: string;
};

function goalLabel(row: TestCasesListRow): string {
  return row.goal?.plainText?.trim() || row.title?.trim() || '—';
}

type SortableRowProps = {
  row: TestCasesListRow;
  sortable: boolean;
  onOpen: (row: TestCasesListRow) => void;
  onDelete?: (row: TestCasesListRow) => void;
  onDuplicate?: (row: TestCasesListRow) => void;
  onOutcomeChange?: (row: TestCasesListRow, outcome: TestResultOutcome) => void;
  openingId: string | null;
  deletingId: string | null;
  duplicatingId: string | null;
  rowKey: string;
};

function SortableTestCaseRow({
  row,
  sortable,
  onOpen,
  onDelete,
  onDuplicate,
  onOutcomeChange,
  openingId,
  deletingId,
  duplicatingId,
  rowKey,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !sortable,
  });

  const label = goalLabel(row);
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'pointer',
  };

  const actionsWidth =
    48 + (onDuplicate ? 36 : 0) + (onDelete ? 36 : 0);

  return (
    <Table.Tr
      ref={setNodeRef}
      key={rowKey}
      className={`tcm-table-row${isDragging ? ' is-dragging' : ''}`}
      style={style}
      onClick={() => onOpen(row)}
    >
      <Table.Td
        onClick={(event) => {
          if (sortable) {
            event.stopPropagation();
          }
        }}
      >
        <Group gap={6} wrap="nowrap">
          {sortable ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Перетащить"
              style={{ cursor: 'grab' }}
              {...attributes}
              {...listeners}
            >
              <IconGripVertical size={16} />
            </ActionIcon>
          ) : null}
          <Text fw={600}>{row.number}</Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text lineClamp={2} title={label}>
          {label}
        </Text>
      </Table.Td>
      <Table.Td>{dayjs(row.createdAt).format('DD.MM.YYYY HH:mm')}</Table.Td>
      <Table.Td>{dayjs(row.updatedAt).format('DD.MM.YYYY HH:mm')}</Table.Td>
      <Table.Td
        style={{ width: 118 }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <TestOutcomeControl
          value={row.testOutcome}
          onChange={
            onOutcomeChange
              ? (outcome) => {
                  onOutcomeChange(row, outcome);
                }
              : undefined
          }
        />
      </Table.Td>
      <Table.Td
        style={{ width: actionsWidth }}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Group gap={4} wrap="nowrap" justify="flex-end">
          <Tooltip label="Открыть">
            <ActionIcon
              variant="subtle"
              loading={openingId === row.id}
              onClick={() => onOpen(row)}
            >
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          {onDuplicate ? (
            <Tooltip label="Копировать">
              <ActionIcon
                variant="subtle"
                loading={duplicatingId === row.id}
                onClick={() => onDuplicate(row)}
              >
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <Tooltip label="Удалить">
              <ActionIcon
                variant="subtle"
                color="red"
                loading={deletingId === row.id}
                onClick={() => onDelete(row)}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export function TestCasesListTable({
  rows,
  onOpen,
  onDelete,
  onDuplicate,
  onOutcomeChange,
  onReorder,
  openingId = null,
  deletingId = null,
  duplicatingId = null,
  emptyText = 'Нет тест-кейсов',
  rowKeyPrefix = '',
}: TestCasesListTableProps) {
  const sortable = Boolean(onReorder) && rows.length > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!onReorder) {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = rows.findIndex((row) => row.id === active.id);
    const newIndex = rows.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const next = arrayMove(rows, oldIndex, newIndex);
    onReorder(next.map((row) => row.id));
  };

  const actionsColWidth =
    56 + (onDuplicate ? 36 : 0) + (onDelete ? 36 : 0);

  const table = (
    <Box className="tcm-table-wrap">
      <Table
        striped={!sortable}
        highlightOnHover
        withTableBorder
        withColumnBorders
        horizontalSpacing="sm"
        verticalSpacing="sm"
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: sortable ? 140 : 120 }}>Тест №</Table.Th>
            <Table.Th>Цель / название</Table.Th>
            <Table.Th style={{ width: 160 }}>Создан</Table.Th>
            <Table.Th style={{ width: 160 }}>Изменён</Table.Th>
            <Table.Th style={{ width: 118 }}>Результат</Table.Th>
            <Table.Th style={{ width: actionsColWidth }}> </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" ta="center" py="lg">
                  {emptyText}
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <SortableTestCaseRow
                key={`${rowKeyPrefix}${row.id}`}
                rowKey={`${rowKeyPrefix}${row.id}`}
                row={row}
                sortable={sortable}
                onOpen={onOpen}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onOutcomeChange={onOutcomeChange}
                openingId={openingId}
                deletingId={deletingId}
                duplicatingId={duplicatingId}
              />
            ))
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );

  if (!onReorder) {
    return table;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        {table}
      </SortableContext>
    </DndContext>
  );
}
