import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconCheck, IconCircle, IconX } from '@tabler/icons-react';
import {
  TEST_OUTCOME_LABELS,
  TEST_OUTCOME_UNSET_LABEL,
} from '@/domain/labels/testCaseLabels';
import type { TestResultOutcome } from '@/domain/types';

const OUTCOME_OPTIONS = [
  {
    value: null,
    label: TEST_OUTCOME_UNSET_LABEL,
    color: 'gray',
    Icon: IconCircle,
  },
  {
    value: 'passed' as const,
    label: TEST_OUTCOME_LABELS.passed,
    color: 'green',
    Icon: IconCheck,
  },
  {
    value: 'failed' as const,
    label: TEST_OUTCOME_LABELS.failed,
    color: 'red',
    Icon: IconX,
  },
];

type TestOutcomeControlProps = {
  value: TestResultOutcome;
  onChange?: (value: TestResultOutcome) => void;
  disabled?: boolean;
};

export function TestOutcomeControl({
  value,
  onChange,
  disabled = false,
}: TestOutcomeControlProps) {
  const editable = Boolean(onChange) && !disabled;
  const current = value ?? null;

  return (
    <Group gap={4} wrap="nowrap" justify="center">
      {OUTCOME_OPTIONS.map((option) => {
        const selected = current === option.value;
        const Icon = option.Icon;
        const isUnset = option.value === null;
        const emphasize = selected && !isUnset;

        return (
          <Tooltip key={option.label} label={option.label} openDelay={400}>
            <ActionIcon
              variant={emphasize ? 'light' : 'subtle'}
              color={selected ? option.color : 'gray'}
              size="sm"
              radius="xl"
              disabled={disabled}
              aria-label={option.label}
              aria-pressed={selected}
              onClick={(event) => {
                event.stopPropagation();
                if (!editable || selected) {
                  return;
                }
                onChange?.(option.value);
              }}
              style={{
                opacity: selected ? (isUnset ? 0.7 : 1) : 0.35,
                cursor: editable && !selected ? 'pointer' : undefined,
              }}
            >
              <Icon size={16} stroke={emphasize ? 2.4 : 1.7} />
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Group>
  );
}
