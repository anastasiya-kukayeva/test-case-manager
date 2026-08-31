import { ActionIcon, Box, Checkbox, Group, Table, Text, Tooltip } from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconCopy,
  IconEdit,
  IconFileWord,
  IconTrash,
} from '@tabler/icons-react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnPinningState,
  type ColumnSizingState,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import type { TestCaseTableRow } from '@/application/testCases/filterTestCases';
import { TestOutcomeControl } from '@/components/testCases/TestOutcomeControl';
import type { TestResultOutcome } from '@/domain/types';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';
import '@/components/testCases/testCasesTable.css';

type TestCasesTableProps = {
  data: TestCaseTableRow[];
  onEdit: (row: TestCaseTableRow) => void;
  onDuplicate: (row: TestCaseTableRow) => void;
  onDelete: (ids: string[]) => void;
  onExportDocx?: (row: TestCaseTableRow) => void;
  onOutcomeChange?: (row: TestCaseTableRow, outcome: TestResultOutcome) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') {
    return <IconArrowUp size={14} />;
  }
  if (sorted === 'desc') {
    return <IconArrowDown size={14} />;
  }
  return <IconArrowsSort size={14} />;
}

export function TestCasesTable({
  data,
  onEdit,
  onDuplicate,
  onDelete,
  onExportDocx,
  onOutcomeChange,
  rowSelection,
  onRowSelectionChange,
}: TestCasesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updatedAt', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const columnVisibility = useTestCaseTableStore((state) => state.columnVisibility);
  const setColumnVisibility = useTestCaseTableStore((state) => state.setColumnVisibility);
  const columnSizing = useTestCaseTableStore((state) => state.columnSizing);
  const setColumnSizing = useTestCaseTableStore((state) => state.setColumnSizing);
  const columnPinning = useTestCaseTableStore((state) => state.columnPinning);
  const setColumnPinning = useTestCaseTableStore((state) => state.setColumnPinning);
  const pageSize = useTestCaseTableStore((state) => state.pageSize);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageSize, pageIndex: 0 }));
  }, [pageSize, data]);

  const columns = useMemo<ColumnDef<TestCaseTableRow>[]>(
    () => [
      {
        id: 'select',
        size: 44,
        enableSorting: false,
        enableResizing: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Выделить все"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Выделить строку"
          />
        ),
      },
      {
        accessorKey: 'number',
        id: 'number',
        header: 'ID',
        size: 120,
        cell: ({ getValue }) => <Text fw={600}>{String(getValue() ?? '')}</Text>,
      },
      {
        accessorKey: 'title',
        id: 'title',
        header: 'Название',
        size: 260,
        cell: ({ getValue }) => (
          <Text lineClamp={2} title={String(getValue() ?? '')}>
            {String(getValue() ?? '')}
          </Text>
        ),
      },
      {
        accessorKey: 'createdAt',
        id: 'createdAt',
        header: 'Дата создания',
        size: 150,
        cell: ({ getValue }) => dayjs(String(getValue())).format('DD.MM.YYYY HH:mm'),
      },
      {
        accessorKey: 'updatedAt',
        id: 'updatedAt',
        header: 'Дата изменения',
        size: 150,
        cell: ({ getValue }) => dayjs(String(getValue())).format('DD.MM.YYYY HH:mm'),
      },
      {
        accessorKey: 'testOutcome',
        id: 'testOutcome',
        header: 'Результат',
        size: 130,
        sortingFn: (rowA, rowB) => {
          const rank = (value: unknown) =>
            value === 'passed' ? 2 : value === 'failed' ? 1 : 0;
          return rank(rowA.original.testOutcome) - rank(rowB.original.testOutcome);
        },
        cell: ({ row }) => (
          <TestOutcomeControl
            value={row.original.testOutcome}
            onChange={
              onOutcomeChange
                ? (outcome) => {
                    onOutcomeChange(row.original, outcome);
                  }
                : undefined
            }
          />
        ),
      },
      {
        id: 'actions',
        header: 'Действия',
        size: 196,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Редактировать">
              <ActionIcon variant="subtle" onClick={() => onEdit(row.original)}>
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Экспорт ПМИ (Word)">
              <ActionIcon
                variant="subtle"
                color="blue"
                onClick={() => onExportDocx?.(row.original)}
              >
                <IconFileWord size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Дублировать">
              <ActionIcon variant="subtle" onClick={() => onDuplicate(row.original)}>
                <IconCopy size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Удалить">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => void onDelete([row.original.id])}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [onDelete, onDuplicate, onEdit, onExportDocx, onOutcomeChange],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
      columnVisibility: columnVisibility as VisibilityState,
      columnSizing: columnSizing as ColumnSizingState,
      columnPinning: columnPinning as ColumnPinningState,
      pagination,
    },
    enableRowSelection: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onRowSelectionChange,
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(columnVisibility as VisibilityState)
          : updater;
      setColumnVisibility(next);
    },
    onColumnSizingChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(columnSizing as ColumnSizingState) : updater;
      setColumnSizing(next);
    },
    onColumnPinningChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater(columnPinning as ColumnPinningState)
          : updater;
      setColumnPinning({
        left: next.left ?? [],
        right: next.right ?? [],
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  const headerGroups = table.getHeaderGroups();
  const rows = table.getRowModel().rows;

  return (
    <Box className="tcm-table-wrap">
      <Table
        striped
        highlightOnHover
        withTableBorder
        withColumnBorders
        horizontalSpacing="sm"
        verticalSpacing="sm"
        style={{ minWidth: table.getCenterTotalSize() }}
      >
        <Table.Thead>
          {headerGroups.map((headerGroup) => (
            <Table.Tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                const isPinned = header.column.getIsPinned();

                return (
                  <Table.Th
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      position: isPinned ? 'sticky' : undefined,
                      left:
                        isPinned === 'left'
                          ? `${header.column.getStart('left')}px`
                          : undefined,
                      right:
                        isPinned === 'right'
                          ? `${header.column.getAfter('right')}px`
                          : undefined,
                      zIndex: isPinned ? 2 : 1,
                      background: 'var(--mantine-color-body)',
                    }}
                  >
                    {header.isPlaceholder ? null : (
                      <Group
                        gap={6}
                        wrap="nowrap"
                        style={{ cursor: canSort ? 'pointer' : 'default' }}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort ? <SortIcon sorted={sorted} /> : null}
                      </Group>
                    )}
                    {header.column.getCanResize() ? (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`tcm-resizer ${header.column.getIsResizing() ? 'is-resizing' : ''}`}
                      />
                    ) : null}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={columns.length}>
                <Text c="dimmed" ta="center" py="lg">
                  Нет тест-кейсов по текущим фильтрам
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <Table.Tr
                key={row.id}
                className={`tcm-table-row${row.getIsSelected() ? ' is-selected' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onEdit(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const isPinned = cell.column.getIsPinned();
                  const isInteractive =
                    cell.column.id === 'select' ||
                    cell.column.id === 'actions' ||
                    cell.column.id === 'testOutcome';
                  return (
                    <Table.Td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        position: isPinned ? 'sticky' : undefined,
                        left:
                          isPinned === 'left'
                            ? `${cell.column.getStart('left')}px`
                            : undefined,
                        right:
                          isPinned === 'right'
                            ? `${cell.column.getAfter('right')}px`
                            : undefined,
                        zIndex: isPinned ? 1 : 0,
                      }}
                      onClick={isInteractive ? (event) => event.stopPropagation() : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" mt="md">
        <Text size="sm" c="dimmed">
          Страница {table.getState().pagination.pageIndex + 1} из{' '}
          {Math.max(table.getPageCount(), 1)}
        </Text>
        <Group gap="xs">
          <ActionIcon
            variant="default"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            aria-label="Предыдущая страница"
          >
            ‹
          </ActionIcon>
          <ActionIcon
            variant="default"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            aria-label="Следующая страница"
          >
            ›
          </ActionIcon>
        </Group>
      </Group>
    </Box>
  );
}
