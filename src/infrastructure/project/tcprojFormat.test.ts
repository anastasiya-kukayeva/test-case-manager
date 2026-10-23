import { describe, expect, it } from 'vitest';
import { AppError } from '@/application/errors/AppError';
import { createEmptyTaskDocument, createEmptyTestCase } from '@/domain/factories/createEntities';
import {
  ensureTaskExtension,
  parseTaskFileContent,
  serializeTaskDocument,
} from '@/infrastructure/project/tcprojFormat';

describe('ensureTaskExtension', () => {
  it('adds .tctask and keeps both current and legacy extensions', () => {
    expect(ensureTaskExtension('C:\\tasks\\Оплата')).toBe('C:\\tasks\\Оплата.tctask');
    expect(ensureTaskExtension('C:\\tasks\\Оплата\\')).toBe('C:\\tasks\\Оплата.tctask');
    expect(ensureTaskExtension('C:\\tasks\\Оплата.tctask')).toBe('C:\\tasks\\Оплата.tctask');
    expect(ensureTaskExtension('C:\\tasks\\Оплата.TCPROJ')).toBe('C:\\tasks\\Оплата.TCPROJ');
  });
});

describe('serializeTaskDocument / parseTaskFileContent', () => {
  it('round-trips a task and trims the parent id', () => {
    const source = createEmptyTaskDocument({
      meta: {
        id: 'task-1',
        name: 'Оплата',
        parentTaskId: ' parent ',
      },
      testCases: [createEmptyTestCase({ id: 'case-1', number: '4', title: 'Успешная оплата' })],
    });

    const serialized = serializeTaskDocument(source);
    const parsed = parseTaskFileContent(serialized);

    expect(JSON.parse(serialized)).toMatchObject({ magic: 'TCM_TASK', formatVersion: 1 });
    expect(parsed.meta.id).toBe('task-1');
    expect(parsed.meta.name).toBe('Оплата');
    expect(parsed.meta.parentTaskId).toBe('parent');
    expect(parsed.testCases.map((item) => [item.id, item.number, item.title])).toEqual([
      ['case-1', '4', 'Успешная оплата'],
    ]);
  });

  it('reads a legacy project envelope, a bare document and old step rows', () => {
    const legacy = {
      magic: 'TCM_PROJECT',
      document: {
        meta: {
          id: 'old',
          name: 'Старая задача',
          createdAt: '2020-01-01T00:00:00.000Z',
          updatedAt: '2020-01-02T00:00:00.000Z',
          testGoal: 'Проверить оплату',
          testObjectLinks: [
            { id: 'link-1', title: 'Jira', url: 'https://jira.example' },
            { title: '', url: '' },
            { title: 'Только имя', url: '' },
          ],
        },
        testCases: [
          {
            id: 'case-1',
            steps: [{ action: 'Открыть <форму>', expectedResult: 'Форма открыта' }],
          },
        ],
      },
    };

    const parsed = parseTaskFileContent(JSON.stringify(legacy));

    expect(parsed.meta.name).toBe('Старая задача');
    expect(parsed.meta.testGoal).toEqual({
      html: '<p>Проверить оплату</p>',
      plainText: 'Проверить оплату',
    });
    expect(parsed.meta.testObjectLinks.map((link) => link.title)).toEqual(['Jira', 'Только имя']);
    expect(parsed.testCases[0]?.steps.html).toContain('&lt;форму&gt;');
    expect(parsed.testCases[0]?.includeInReport).toBe(true);
    expect(parsed.testCases[0]?.includeInRollbackReport).toBe(true);
    expect(parsed.testCases[0]?.includeInRegression).toBe(false);
    expect(parsed.testCases[0]?.regressionOnly).toBe(false);
    expect(parsed.testCases[0]?.author).toBe('');

    const bare = parseTaskFileContent(
      JSON.stringify({
        meta: legacy.document.meta,
        testCases: [],
      }),
    );
    expect(bare.meta.id).toBe('old');
    expect(bare.testCases).toEqual([]);
  });

  it('rejects broken json, a foreign file, a missing meta field and a newer format', () => {
    expect(() => parseTaskFileContent('{')).toThrow(AppError);
    expect(() => parseTaskFileContent('{')).toThrow(/JSON/);
    expect(() => parseTaskFileContent('[]')).toThrow(/не является задачей/);
    expect(() =>
      parseTaskFileContent(JSON.stringify({ meta: { name: 'Без id' }, testCases: [] })),
    ).toThrow(/id/);
    expect(() =>
      parseTaskFileContent(
        JSON.stringify({
          meta: {
            id: '1',
            name: 'Новее',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          testCases: [],
          formatVersion: 99,
        }),
      ),
    ).toThrow(/новее поддерживаемой/);
  });
});
