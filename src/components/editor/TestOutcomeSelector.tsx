import { Group, Paper, SegmentedControl, Text } from '@mantine/core';
import type { TestResultOutcome } from '@/domain/types';

type TestOutcomeSelectorProps = {
  value: TestResultOutcome;
  onChange: (value: TestResultOutcome) => void;
};

export function TestOutcomeSelector({ value, onChange }: TestOutcomeSelectorProps) {
  const color =
    value === 'passed' ? 'green' : value === 'failed' ? 'red' : 'gray';

  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      style={{
        borderColor:
          value === 'passed'
            ? 'var(--mantine-color-green-6)'
            : value === 'failed'
              ? 'var(--mantine-color-red-6)'
              : undefined,
        background:
          value === 'passed'
            ? 'var(--mantine-color-green-light)'
            : value === 'failed'
              ? 'var(--mantine-color-red-light)'
              : undefined,
      }}
    >
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600}>Результат тестирования</Text>
          <Text size="sm" c="dimmed">
            Индикатор:{' '}
            <Text span fw={700} c={color}>
              {value === 'passed' ? 'Успешно' : value === 'failed' ? 'Неуспешно' : 'Не выбран'}
            </Text>
          </Text>
        </div>
        <SegmentedControl
          value={value ?? 'none'}
          onChange={(next) => {
            if (next === 'none') {
              onChange(null);
              return;
            }
            onChange(next as 'passed' | 'failed');
          }}
          data={[
            { label: 'Не выбран', value: 'none' },
            { label: '✅ Успешно', value: 'passed' },
            { label: '❌ Неуспешно', value: 'failed' },
          ]}
          color={value === 'passed' ? 'green' : value === 'failed' ? 'red' : 'gray'}
        />
      </Group>
    </Paper>
  );
}
