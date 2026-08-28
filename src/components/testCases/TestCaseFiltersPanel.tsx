import { Button, Card, Group, MultiSelect, Stack, TextInput } from '@mantine/core';
import { IconFilterOff, IconSearch } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
import { TestCaseDateFilter } from '@/components/testCases/TestCaseDateFilter';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';
import { useUiStore } from '@/stores/useUiStore';

type TestCaseFiltersPanelProps = {
  taskOptions: string[];
};

export function TestCaseFiltersPanel({ taskOptions }: TestCaseFiltersPanelProps) {
  const filters = useTestCaseTableStore((state) => state.filters);
  const setSearch = useTestCaseTableStore((state) => state.setSearch);
  const setFilters = useTestCaseTableStore((state) => state.setFilters);
  const clearFilters = useTestCaseTableStore((state) => state.clearFilters);
  const focusSearchRequestId = useUiStore((state) => state.focusSearchRequestId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearchRequestId > 0) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [focusSearchRequestId]);

  const taskFilterValue = filters.task.length > 0 ? filters.task : filters.project;

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <TextInput
          ref={searchInputRef}
          placeholder="Поиск по ID, названию, задаче…"
          leftSection={<IconSearch size={16} />}
          value={filters.search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />

        <Group grow align="flex-start">
          <MultiSelect
            label="Задача"
            data={taskOptions}
            value={taskFilterValue}
            onChange={(value) => setFilters({ task: value, project: [] })}
            searchable
            clearable
          />
        </Group>

        <TestCaseDateFilter />

        <Button
          variant="light"
          color="gray"
          leftSection={<IconFilterOff size={16} />}
          w="fit-content"
          onClick={clearFilters}
        >
          Очистить фильтр
        </Button>
      </Stack>
    </Card>
  );
}
