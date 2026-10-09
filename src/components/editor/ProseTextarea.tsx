import { Textarea, type TextareaProps } from '@mantine/core';
import type { ChangeEvent, FocusEvent } from 'react';
import { applyRussianTypography } from '@/application/text/russianTypography';

type ProseTextareaProps = TextareaProps;

/** Textarea that applies Russian typography when the field is left. */
export function ProseTextarea({ value, onChange, onBlur, ...rest }: ProseTextareaProps) {
  const handleBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
    onBlur?.(event);
    const current = event.currentTarget?.value ?? event.target?.value ?? '';
    const next = applyRussianTypography(current);
    if (next === current || !onChange) {
      return;
    }
    onChange({
      currentTarget: { value: next },
      target: { value: next },
    } as ChangeEvent<HTMLTextAreaElement>);
  };

  return (
    <Textarea
      {...rest}
      lang="ru"
      spellCheck
      value={value}
      onChange={onChange}
      onBlur={handleBlur}
    />
  );
}
