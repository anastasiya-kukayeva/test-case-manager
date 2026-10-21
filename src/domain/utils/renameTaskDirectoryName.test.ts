import { describe, expect, it } from 'vitest';
import { createEmptyTaskDocument } from '@/domain/factories/createEntities';
import { renameTaskDirectoryName } from '@/domain/utils/renameTaskDirectoryName';

describe('renameTaskDirectoryName', () => {
  it('replaces the task application and keeps the module', () => {
    const document = createEmptyTaskDocument({
      meta: { name: 'Задача', application: 'Касса', module: '1. Оплата' },
    });

    const next = renameTaskDirectoryName(document, 'application', 'касса', 'Касса 2');

    expect(next?.meta.application).toBe('Касса 2');
    expect(next?.meta.module).toBe('1. Оплата');
    expect(next?.meta.name).toBe('Задача');
  });

  it('replaces the task module when only the letter case changed', () => {
    const document = createEmptyTaskDocument({
      meta: { module: 'Модуль' },
    });

    const next = renameTaskDirectoryName(document, 'module', 'Модуль', 'модуль');

    expect(next?.meta.module).toBe('модуль');
  });

  it('leaves a task that uses another name', () => {
    const document = createEmptyTaskDocument({
      meta: { application: 'Склад', module: '2. Остатки' },
    });

    expect(renameTaskDirectoryName(document, 'module', '1. Оплата', '1. Оплаты')).toBeNull();
    expect(renameTaskDirectoryName(document, 'application', 'Касса', 'Касса 2')).toBeNull();
  });
});
