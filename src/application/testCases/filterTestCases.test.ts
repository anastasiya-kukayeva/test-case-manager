import { describe, expect, it } from 'vitest';
import { createEmptyRichText, createEmptyTestCase } from '@/domain/factories/createEntities';
import {
  DEFAULT_TEST_CASE_FILTERS,
  collectUniqueValues,
  filterTestCases,
  toTestCaseRows,
  type TestCaseFiltersState,
} from '@/application/testCases/filterTestCases';

function filters(partial: Partial<TestCaseFiltersState>): TestCaseFiltersState {
  return { ...DEFAULT_TEST_CASE_FILTERS, ...partial };
}

const rows = toTestCaseRows(
  [
    createEmptyTestCase({
      id: 'pay',
      number: '12',
      title: 'Успешная оплата',
      section: 'Платежи',
      module: 'Касса',
      author: 'Анна',
      developer: 'Борис',
      priority: 'high',
      status: 'ready',
      createdAt: '2026-03-15T10:00:00',
      updatedAt: '2026-04-01T10:00:00',
    }),
    createEmptyTestCase({
      id: 'refund',
      number: '3',
      title: 'Возврат',
      section: 'Платежи',
      module: 'Возвраты',
      author: 'Анна',
      priority: 'low',
      status: 'draft',
      createdAt: '2026-01-02T10:00:00',
      updatedAt: '2026-01-03T10:00:00',
    }),
  ],
  'ПМИ оплата',
);

describe('filterTestCases', () => {
  it('searches number, title and people without case sensitivity', () => {
    expect(filterTestCases(rows, filters({ search: 'УСПЕШН' })).map((row) => row.id)).toEqual([
      'pay',
    ]);
    expect(filterTestCases(rows, filters({ search: 'пми' })).map((row) => row.id)).toEqual([
      'pay',
      'refund',
    ]);
    expect(filterTestCases(rows, filters({ search: 'борис' })).map((row) => row.id)).toEqual([
      'pay',
    ]);
    expect(filterTestCases(rows, filters({ search: 'нет такого' }))).toEqual([]);
  });

  it('prefers the task filter and falls back to the legacy project filter', () => {
    expect(filterTestCases(rows, filters({ task: ['Другая задача'] }))).toEqual([]);
    expect(filterTestCases(rows, filters({ project: ['ПМИ оплата'] }))).toHaveLength(2);
    expect(
      filterTestCases(rows, filters({ task: ['Другая задача'], project: ['ПМИ оплата'] })),
    ).toEqual([]);
  });

  it('combines section, priority, status and the selected date field', () => {
    const matched = filterTestCases(
      rows,
      filters({
        section: ['Платежи'],
        priority: ['high'],
        status: ['ready'],
        date: {
          field: 'updatedAt',
          preset: 'allTime',
          exactDate: '2026-04-01',
          range: [null, null],
        },
      }),
    );

    expect(matched.map((row) => row.id)).toEqual(['pay']);
  });
});

describe('collectUniqueValues', () => {
  it('returns trimmed unique values in Russian alphabetical order', () => {
    const labeled = [
      ...rows,
      { ...rows[0], section: '  ', module: 'яблоко' },
      { ...rows[0], module: 'Бета' },
    ];

    expect(collectUniqueValues(labeled, 'module')).toEqual(['Бета', 'Возвраты', 'Касса', 'яблоко']);
    expect(collectUniqueValues(labeled, 'section')).toEqual(['Платежи']);
  });
});

describe('toTestCaseRows', () => {
  it('copies the task name into both current and legacy fields', () => {
    const [row] = toTestCaseRows(
      [createEmptyTestCase({ goal: createEmptyRichText('Цель') })],
      'Задача',
    );

    expect(row?.taskName).toBe('Задача');
    expect(row?.projectName).toBe('Задача');
  });
});
