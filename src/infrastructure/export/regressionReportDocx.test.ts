import { describe, expect, it } from 'vitest';
import {
  ROLLBACK_REPORT_TABLE_TITLE,
  regressionReportFileName,
  regressionReportHeaderLines,
  type RegressionReportHeader,
} from '@/infrastructure/export/regressionReportDocx';

const header: RegressionReportHeader = {
  moduleName: 'CPM',
  taskShortName: 'Депозиты',
  conductedAt: new Date(2026, 9, 1),
  authorName: 'Кукаева А.Д.',
  environmentName: 'https://example',
  cases: [],
};

describe('regression report header', () => {
  it('keeps the regression title and testing type', () => {
    const lines = regressionReportHeaderLines(header);
    expect(lines[0]).toBe('Отчет по регрессионному тестированию');
    expect(lines[3]).toBe('Тип тестирования: Регрессионное');
    expect(regressionReportFileName('Депозиты', header.conductedAt)).toBe(
      'Регрессионный отчет - Депозиты за октябрь 2026',
    );
  });

  it('switches the rollback title, testing type and file name', () => {
    const lines = regressionReportHeaderLines({ ...header, kind: 'rollback' });
    expect(lines[0]).toBe('Отчёт по регрессионному тестированию отката доработок');
    expect(lines[3]).toBe('Тип тестирования: Тестирование отката');
    expect(lines[1]).toBe('Проект: BPM-система (CPM)');
    expect(ROLLBACK_REPORT_TABLE_TITLE).toBe('Основные модули и статус проверки после отката:');
    expect(regressionReportFileName('Депозиты', header.conductedAt, 'rollback')).toBe(
      'Отчет отката доработок - Депозиты за октябрь 2026',
    );
  });
});
