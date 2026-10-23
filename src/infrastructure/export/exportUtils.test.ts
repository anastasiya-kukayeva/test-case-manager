import { describe, expect, it } from 'vitest';
import { createEmptyTestCase } from '@/domain/factories/createEntities';
import {
  isRegressionMode,
  matchesRegressionMode,
} from '@/application/regression/loadRegressionGroups';
import {
  cssColorToHex,
  htmlToExportBlocks,
  htmlToPlainParagraphs,
  listDepthFromExportLine,
  mergeAdjacentFenceBlocks,
  scaleImageToWidth,
} from '@/infrastructure/export/exportUtils';

describe('matchesRegressionMode', () => {
  it('uses the shared flag for the suite and the task flag for a task regression', () => {
    const shared = createEmptyTestCase({
      includeInRegression: true,
      includeInTaskRegression: false,
    });
    const own = createEmptyTestCase({
      includeInRegression: false,
      includeInTaskRegression: true,
    });

    expect(matchesRegressionMode(shared, 'suite')).toBe(true);
    expect(matchesRegressionMode(shared, 'task')).toBe(false);
    expect(matchesRegressionMode(own, 'task')).toBe(true);
    expect(matchesRegressionMode(own, 'suite')).toBe(false);
    expect(isRegressionMode('suite')).toBe(true);
    expect(isRegressionMode('other')).toBe(false);
  });
});

describe('htmlToExportBlocks', () => {
  it('returns nothing for blank html', () => {
    expect(htmlToExportBlocks('   ')).toEqual([]);
  });

  it('keeps bold text, lists, screenshots, code and logs in order', () => {
    const blocks = htmlToExportBlocks(
      [
        '<p>Цель <strong>теста</strong></p>',
        '<ol><li>Первый<ul><li>вложенный</li></ul></li><li>Второй</li></ol>',
        '<p><img src="data:image/png;base64,qq" alt="экран"></p>',
        '<pre><code class="language-sql">select 1</code></pre>',
        '<pre class="tcm-log-block"><code>error</code></pre>',
      ].join(''),
    );

    expect(blocks[0]).toMatchObject({ type: 'text', text: 'Цель теста' });
    if (blocks[0]?.type === 'text') {
      expect(blocks[0].runs.some((run) => run.bold && run.text.includes('теста'))).toBe(true);
    }
    expect(
      htmlToPlainParagraphs(
        '<ol><li>Первый<ul><li>вложенный</li></ul></li><li>Второй</li></ol><pre><code class="language-sql">select 1</code></pre>',
      ),
    ).toEqual(['1. Первый', ' ▪ вложенный', '2. Второй', 'select 1']);

    expect(blocks.filter((block) => block.type === 'image')).toEqual([
      { type: 'image', dataUrl: 'data:image/png;base64,qq', alt: 'экран' },
    ]);
    expect(blocks.filter((block) => block.type === 'code' || block.type === 'log')).toEqual([
      { type: 'code', text: 'select 1', language: 'sql' },
      { type: 'log', text: 'error' },
    ]);
    const linked = htmlToExportBlocks(
      '<p>Проверить <a href="https://jira.example/browse/1">форму https://jira.example/browse/1</a></p>',
    );
    expect(linked[0]).toMatchObject({ type: 'text', text: 'Проверить форму' });
    if (linked[0]?.type === 'text') {
      expect(linked[0].runs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: 'форму',
            link: 'https://jira.example/browse/1',
          }),
        ]),
      );
    }

    expect(listDepthFromExportLine('  ▪ вложенный')).toBe(1);
    expect(listDepthFromExportLine('обычный текст')).toBeUndefined();
  });

  it('joins adjacent fences of the same kind and keeps a different language apart', () => {
    expect(
      mergeAdjacentFenceBlocks([
        { type: 'code', text: 'select 1', language: 'sql' },
        { type: 'code', text: 'select 2', language: 'sql' },
        { type: 'code', text: 'const a = 1', language: 'javascript' },
      ]),
    ).toEqual([
      { type: 'code', text: 'select 1\nselect 2', language: 'sql' },
      { type: 'code', text: 'const a = 1', language: 'javascript' },
    ]);
  });
});

describe('export measurements', () => {
  it('converts css colors and scales an image down to the page', () => {
    expect(cssColorToHex('#ff00aa')).toBe('FF00AA');
    expect(cssColorToHex('#abc')).toBe('AABBCC');
    expect(cssColorToHex('rgb(0, 128, 255)')).toBe('0080FF');
    expect(cssColorToHex('transparent')).toBeUndefined();

    expect(scaleImageToWidth(200, 100, 400)).toEqual({ width: 200, height: 100 });
    expect(scaleImageToWidth(800, 400, 400)).toEqual({ width: 400, height: 200 });
    expect(scaleImageToWidth(200, 400, 400, 100)).toEqual({ width: 50, height: 100 });
  });
});
