import { Group, Paper, SegmentedControl, Text } from '@mantine/core';
import { IconCheck, IconCircle, IconX } from '@tabler/icons-react';
import {
  TEST_OUTCOME_LABELS,
  TEST_OUTCOME_UNSET_LABEL,
  getTestOutcomeLabel,
} from '@/domain/labels/testCaseLabels';
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
              {getTestOutcomeLabel(value)}
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
            {
              label: (
                <Group gap={6} wrap="nowrap" justify="center">
                  <IconCircle size={14} />
                  {TEST_OUTCOME_UNSET_LABEL}
                </Group>
              ),
              value: 'none',
            },
            {
              label: (
                <Group gap={6} wrap="nowrap" justify="center">
                  <IconCheck size={14} />
                  {TEST_OUTCOME_LABELS.passed}
                </Group>
              ),
              value: 'passed',
            },
            {
              label: (
                <Group gap={6} wrap="nowrap" justify="center">
                  <IconX size={14} />
                  {TEST_OUTCOME_LABELS.failed}
                </Group>
              ),
              value: 'failed',
            },
          ]}
          color={value === 'passed' ? 'green' : value === 'failed' ? 'red' : 'gray'}
        />
      </Group>
    </Paper>
  );
}
