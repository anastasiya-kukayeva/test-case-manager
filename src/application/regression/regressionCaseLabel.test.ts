import { describe, expect, it } from 'vitest';
import { regressionCaseLabel } from '@/application/regression/regressionCaseLabel';

describe('regressionCaseLabel', () => {
  it('keeps the visible name of a hyperlink and drops the address', () => {
    expect(
      regressionCaseLabel({
        html: '<p>Проверить <a href="https://jira.example/browse/1">форму входа</a></p>',
        plainText: 'Проверить форму входа',
      }),
    ).toBe('Проверить форму входа');
  });

  it('drops a raw address written next to the name', () => {
    expect(
      regressionCaseLabel({
        html: '<p>Проверка входа https://jira.example/browse/1</p>',
        plainText: 'Проверка входа https://jira.example/browse/1',
      }),
    ).toBe('Проверка входа');
  });

  it('uses the link title when the visible text is the address', () => {
    expect(
      regressionCaseLabel({
        html: '<p><a href="https://jira.example/browse/1" title="Форма входа">https://jira.example/browse/1</a></p>',
        plainText: 'https://jira.example/browse/1',
      }),
    ).toBe('Форма входа');
  });

  it('falls back to the case title when the goal is only an address', () => {
    expect(
      regressionCaseLabel(
        {
          html: '<p>https://jira.example/browse/1</p>',
          plainText: 'https://jira.example/browse/1',
        },
        'Форма входа',
      ),
    ).toBe('Форма входа');
  });

  it('leaves a name that contains a dash', () => {
    expect(
      regressionCaseLabel({
        html: '<p>Шаг 1 — открыть форму</p>',
        plainText: 'Шаг 1 — открыть форму',
      }),
    ).toBe('Шаг 1 — открыть форму');
  });
});
