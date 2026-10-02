import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';

const OPTIONS = [
  { value: true, label: 'Да', color: 'green', Icon: IconCheck },
  { value: false, label: 'Нет', color: 'red', Icon: IconX },
] as const;

type IncludeInReportControlProps = {
  value: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
};

export function IncludeInReportControl({
  value,
  onChange,
  disabled = false,
}: IncludeInReportControlProps) {
  const editable = Boolean(onChange) && !disabled;

  return (
    <Group gap={4} wrap="nowrap" justify="center">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        const Icon = option.Icon;

        return (
          <Tooltip key={option.label} label={option.label} openDelay={400}>
            <ActionIcon
              variant={selected ? 'light' : 'subtle'}
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
                opacity: selected ? 1 : 0.35,
                cursor: editable && !selected ? 'pointer' : undefined,
              }}
            >
              <Icon size={16} stroke={selected ? 2.4 : 1.7} />
            </ActionIcon>
          </Tooltip>
        );
      })}
    </Group>
  );
}
