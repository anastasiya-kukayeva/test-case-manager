import { Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';

function toDateString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

export function TestCaseDateFilter() {
  const date = useTestCaseTableStore((state) => state.filters.date);
  const setDateFilter = useTestCaseTableStore((state) => state.setDateFilter);

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Фильтр по дате
      </Text>
      <DatePickerInput
        type="range"
        placeholder="Выберите даты в календаре"
        value={date.range}
        onChange={(value) => {
          const rangeValue = Array.isArray(value) ? value : [null, null];
          setDateFilter({
            range: [toDateString(rangeValue[0]), toDateString(rangeValue[1])],
            exactDate: null,
            preset: 'allTime',
          });
        }}
        valueFormat="DD.MM.YYYY"
        clearable
        maw={360}
      />
    </Stack>
  );
}
