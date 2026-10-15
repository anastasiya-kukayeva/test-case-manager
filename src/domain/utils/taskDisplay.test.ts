import { describe, expect, it } from 'vitest';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';

describe('getTaskShortLabel', () => {
  it('prefers a trimmed short name', () => {
    expect(getTaskShortLabel({ name: 'Длинное название задачи', shortName: '  ОП  ' })).toBe('ОП');
  });

  it('falls back to the name and truncates it', () => {
    expect(getTaskShortLabel({ name: '  Оплата  ' })).toBe('Оплата');
    expect(getTaskShortLabel({ name: '   ' })).toBe('Без названия');

    const name = 'А'.repeat(49);
    expect(getTaskShortLabel({ name })).toBe(`${'А'.repeat(47)}…`);
  });
});
