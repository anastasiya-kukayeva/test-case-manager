import { describe, expect, it } from 'vitest';
import {
  createEmptyRichText,
  createEmptyTaskDocument,
  createEmptyTestCase,
} from '@/domain/factories/createEntities';
import type { ImageAttachment } from '@/domain/types';
import {
  formValuesToTestCasePatch,
  testCaseToFormValues,
} from '@/application/testCases/testCaseFormMapper';
import {
  cloneTaskDocument,
  taskTitleFromFilePath,
} from '@/application/project/taskHierarchyActions';

const screenshot: ImageAttachment = {
  id: 'img-1',
  kind: 'image',
  fileName: 'shot.png',
  mimeType: 'image/png',
  dataUrl: 'data:image/png;base64,abc',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('testCaseToFormValues', () => {
  it('moves a screenshot that is not already in the result into the rich text', () => {
    const values = testCaseToFormValues(
      createEmptyTestCase({
        verificationResult: createEmptyRichText('Проверено'),
        verificationAttachments: [screenshot],
      }),
    );

    expect(values.verificationResult.html).toContain('data:image/png;base64,abc');
    expect(values.verificationResult.html).toContain('Проверено');
    expect(values.verificationAttachments).toEqual([]);
  });

  it('does not duplicate a code block that is already in the result', () => {
    const values = testCaseToFormValues(
      createEmptyTestCase({
        verificationResult: {
          html: '<pre><code>select 1</code></pre>',
          plainText: 'select 1',
        },
        verificationAttachments: [
          {
            id: 'code-1',
            kind: 'code',
            language: 'sql',
            content: 'select 1',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      }),
    );

    expect(values.verificationResult.html.match(/select 1/g)).toHaveLength(1);
  });
});

describe('formValuesToTestCasePatch', () => {
  it('trims text fields and keeps screenshots inside the result html', () => {
    const patch = formValuesToTestCasePatch({
      ...testCaseToFormValues(createEmptyTestCase({ number: ' 2 ', title: '  Оплата  ' })),
      verificationAttachments: [screenshot],
    });

    expect(patch.number).toBe('2');
    expect(patch.title).toBe('Оплата');
    expect(patch.verificationAttachments).toEqual([]);
    expect(patch.updatedAt).toEqual(expect.any(String));
  });
});

describe('cloneTaskDocument', () => {
  it('copies cases and attachments under new ids and can clear the parent', () => {
    const source = createEmptyTaskDocument({
      meta: { name: 'Оплата', shortName: 'ОП', parentTaskId: 'parent-1' },
      testCases: [
        createEmptyTestCase({
          id: 'case-1',
          title: 'Успешная оплата',
          goalImages: [screenshot],
        }),
      ],
    });

    const copy = cloneTaskDocument(source, { parentTaskId: null });

    expect(copy.meta.id).not.toBe(source.meta.id);
    expect(copy.meta.name).toBe('Оплата (копия)');
    expect(copy.meta.shortName).toBe('ОП (копия)');
    expect(copy.meta.parentTaskId).toBeNull();
    expect(copy.testCases[0]?.id).not.toBe('case-1');
    expect(copy.testCases[0]?.title).toBe('Успешная оплата');
    expect(copy.testCases[0]?.goalImages[0]?.id).not.toBe('img-1');
    expect(source.testCases[0]?.goalImages[0]?.id).toBe('img-1');
  });

  it('names a blank task and keeps the source parent when none is passed', () => {
    const source = createEmptyTaskDocument({
      meta: { name: '   ', parentTaskId: 'parent-1' },
    });
    const copy = cloneTaskDocument(source);

    expect(copy.meta.name).toBe('Новая задача (копия)');
    expect(copy.meta.parentTaskId).toBe('parent-1');
  });
});

describe('taskTitleFromFilePath', () => {
  it('uses the file name without a task extension', () => {
    expect(taskTitleFromFilePath('C:\\tasks\\Моя задача.tctask')).toBe('Моя задача');
    expect(taskTitleFromFilePath('C:/tasks/file.TCPROJ')).toBe('file');
    expect(taskTitleFromFilePath('.tctask')).toBe('Новая задача');
  });
});
