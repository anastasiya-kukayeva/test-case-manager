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
import { ActionIcon, Box, Checkbox, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconCopy, IconEdit, IconGripVertical, IconTrash } from '@tabler/icons-react';
import type { CSSProperties } from 'react';
import { IncludeInReportControl } from '@/components/testCases/IncludeInReportControl';
import { TestOutcomeControl } from '@/components/testCases/TestOutcomeControl';
import type { TestCase, TestResultOutcome } from '@/domain/types';
import '@/components/testCases/testCasesTable.css';

export type TestCasesListRow = Pick<
  TestCase,
  'id' | 'number' | 'title' | 'goal' | 'includeInReport' | 'testOutcome'
> & {
  /** Optional second line, for example the task a case was taken from. */
  sourceLabel?: string;
  includeInRegression?: boolean;
  includeInTaskRegression?: boolean;
};

export type RegressionFlagsChange = {
  includeInRegression?: boolean;
  includeInTaskRegression?: boolean;
};

type TestCasesListTableProps = {
  rows: TestCasesListRow[];
  onOpen: (row: TestCasesListRow) => void;
  onDelete?: (row: TestCasesListRow) => void;
  onDuplicate?: (row: TestCasesListRow) => void;
  onIncludeInReportChange?: (row: TestCasesListRow, includeInReport: boolean) => void;
  onRegressionChange?: (row: TestCasesListRow, patch: RegressionFlagsChange) => void;
  onOutcomeChange?: (row: TestCasesListRow, outcome: TestResultOutcome) => void;
  /** When set, rows become draggable; called with ids in the new visual order. */
  onReorder?: (orderedIds: string[]) => void;
  openingId?: string | null;
  deletingId?: string | null;
  duplicatingId?: string | null;
  /** Row ids fading out after a regression mark was turned off. */
  leavingIds?: ReadonlySet<string>;
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
  onIncludeInReportChange?: (row: TestCasesListRow, includeInReport: boolean) => void;
  showIncludeInReport: boolean;
  onRegressionChange?: (row: TestCasesListRow, patch: RegressionFlagsChange) => void;
  showRegression: boolean;
  onOutcomeChange?: (row: TestCasesListRow, outcome: TestResultOutcome) => void;
  openingId: string | null;
  deletingId: string | null;
  duplicatingId: string | null;
  leaving: boolean;
  rowKey: string;
};

function SortableTestCaseRow({
  row,
  sortable,
  onOpen,
  onDelete,
  onDuplicate,
  onIncludeInReportChange,
  showIncludeInReport,
  onRegressionChange,
  showRegression,
  onOutcomeChange,
  openingId,
  deletingId,
  duplicatingId,
  leaving,
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
      className={`tcm-table-row${isDragging ? ' is-dragging' : ''}${leaving ? ' is-leaving' : ''}`}
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
        {row.sourceLabel ? (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {row.sourceLabel}
          </Text>
        ) : null}
      </Table.Td>
      {showRegression ? (
        <>
          <Table.Td
            className="tcm-regression-col"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Group justify="center">
              <Checkbox
                className="tcm-regression-check"
                radius={2}
                size="xs"
                checked={Boolean(row.includeInRegression)}
                aria-label="Добавить в регресс?"
                onChange={(event) => {
                  onRegressionChange?.(row, { includeInRegression: event.currentTarget.checked });
                }}
              />
            </Group>
          </Table.Td>
          <Table.Td
            className="tcm-regression-col"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Group justify="center">
              <Checkbox
                className="tcm-regression-check"
                radius={2}
                size="xs"
                checked={Boolean(row.includeInTaskRegression)}
                aria-label="Добавить в регресс задачи?"
                onChange={(event) => {
                  onRegressionChange?.(row, {
                    includeInTaskRegression: event.currentTarget.checked,
                  });
                }}
              />
            </Group>
          </Table.Td>
        </>
      ) : null}
      {showIncludeInReport ? (
        <Table.Td
          style={{ width: 150 }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <IncludeInReportControl
            value={row.includeInReport !== false}
            onChange={
              onIncludeInReportChange
                ? (includeInReport) => {
                    onIncludeInReportChange(row, includeInReport);
                  }
                : undefined
            }
          />
        </Table.Td>
      ) : null}
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
  onIncludeInReportChange,
  onRegressionChange,
  onOutcomeChange,
  onReorder,
  openingId = null,
  deletingId = null,
  duplicatingId = null,
  leavingIds,
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

  const showIncludeInReport = Boolean(onIncludeInReportChange);
  const showRegression = Boolean(onRegressionChange);
  const columnCount = 4 + (showIncludeInReport ? 1 : 0) + (showRegression ? 2 : 0);
  const headRowSpan = showRegression ? 2 : undefined;
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
            <Table.Th rowSpan={headRowSpan} style={{ width: sortable ? 140 : 120 }}>
              Тест №
            </Table.Th>
            <Table.Th rowSpan={headRowSpan}>Цель / название</Table.Th>
            {showRegression ? (
              <Table.Th colSpan={2} ta="center">
                Регресс
              </Table.Th>
            ) : null}
            {showIncludeInReport ? (
              <Table.Th rowSpan={headRowSpan} style={{ width: 150 }}>
                Добавить в отчет
              </Table.Th>
            ) : null}
            <Table.Th rowSpan={headRowSpan} style={{ width: 118 }}>
              Результат
            </Table.Th>
            <Table.Th rowSpan={headRowSpan} style={{ width: actionsColWidth }}>
              {' '}
            </Table.Th>
          </Table.Tr>
          {showRegression ? (
            <Table.Tr>
              <Table.Th ta="center" className="tcm-regression-col">
                Регресс общий
              </Table.Th>
              <Table.Th ta="center" className="tcm-regression-col">
                Регресс задачи
              </Table.Th>
            </Table.Tr>
          ) : null}
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columnCount}>
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
                onIncludeInReportChange={onIncludeInReportChange}
                showIncludeInReport={showIncludeInReport}
                onRegressionChange={onRegressionChange}
                showRegression={showRegression}
                onOutcomeChange={onOutcomeChange}
                openingId={openingId}
                deletingId={deletingId}
                duplicatingId={duplicatingId}
                leaving={Boolean(leavingIds?.has(row.id))}
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
