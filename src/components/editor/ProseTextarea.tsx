import { Button, Group, Stack, Text, Textarea, type TextareaProps } from '@mantine/core';
import type { ChangeEvent } from 'react';
import { applyRussianTypography } from '@/application/text/russianTypography';

type ProseTextareaProps = TextareaProps;

/** Textarea with a Russian typography action in the label row. */
export function ProseTextarea({
  label,
  description,
  value,
  onChange,
  ...rest
}: ProseTextareaProps) {
  const text = typeof value === 'string' ? value : '';

  const apply = () => {
    const next = applyRussianTypography(text);
    if (next === text || !onChange) {
      return;
    }
    onChange({
      currentTarget: { value: next },
      target: { value: next },
    } as ChangeEvent<HTMLTextAreaElement>);
  };

  return (
    <Stack gap={6}>
      <Group justify="space-between" align="flex-end" wrap="nowrap" gap="sm">
        <div style={{ minWidth: 0 }}>
          {label ? (
            <Text component="div" size="sm" fw={500}>
              {label}
            </Text>
          ) : null}
          {description ? (
            <Text component="div" size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </div>
        <Button
          type="button"
          size="compact-xs"
          variant="light"
          disabled={!text.trim()}
          onClick={apply}
        >
          Чистописание
        </Button>
      </Group>
      <Textarea lang="ru" spellCheck value={value} onChange={onChange} {...rest} />
    </Stack>
  );
}
