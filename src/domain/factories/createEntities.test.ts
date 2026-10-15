import { describe, expect, it } from 'vitest';
import { createEmptyRichText, normalizeStepsContent } from '@/domain/factories/createEntities';
import { isMarkedForRegression } from '@/domain/types';

describe('normalizeStepsContent', () => {
  it('keeps rich text and fills plain text from html when it is missing', () => {
    expect(normalizeStepsContent({ html: '<p>Шаг</p>', plainText: 'Шаг' })).toEqual({
      html: '<p>Шаг</p>',
      plainText: 'Шаг',
    });
    expect(normalizeStepsContent({ html: '<p>Один <b>два</b></p>' })).toEqual({
      html: '<p>Один <b>два</b></p>',
      plainText: 'Один два',
    });
  });

  it('wraps a plain string and returns empty content for nothing', () => {
    expect(normalizeStepsContent('Открыть форму')).toEqual(createEmptyRichText('Открыть форму'));
    expect(normalizeStepsContent(null)).toEqual(createEmptyRichText());
    expect(normalizeStepsContent([])).toEqual(createEmptyRichText());
  });

  it('turns legacy structured steps into an escaped numbered list', () => {
    const content = normalizeStepsContent([
      {
        action: 'Открыть <форму> & сохранить',
        expectedResult: 'Форма открыта',
        actualResult: 'Открылась',
        comment: 'Ок',
      },
      { action: '   ' },
    ]);

    expect(content.html).toContain('Открыть &lt;форму&gt; &amp; сохранить');
    expect(content.html).toContain('Ожидаемый результат: Форма открыта');
    expect(content.html.startsWith('<ol>')).toBe(true);
    expect(content.plainText).toBe(
      '1. Открыть <форму> & сохранить\nОжидаемый результат: Форма открыта\nФактический результат: Открылась\nКомментарий: Ок',
    );
  });
});

describe('isMarkedForRegression', () => {
  it('is true when either regression checkbox is set', () => {
    expect(isMarkedForRegression({ includeInRegression: true })).toBe(true);
    expect(isMarkedForRegression({ includeInTaskRegression: true })).toBe(true);
    expect(isMarkedForRegression({})).toBe(false);
  });
});
