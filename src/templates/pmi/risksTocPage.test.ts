import { describe, expect, it } from 'vitest';
import { createEmptyTaskDocument, createEmptyTestCase } from '@/domain/factories/createEntities';
import type { ExportSettings } from '@/domain/types';
import { estimateRisksTocPage } from '@/templates/pmi/risksTocPage';

const settings: ExportSettings = {
  includeImages: false,
  includeCodeBlocks: false,
  includeLogs: false,
};

describe('estimateRisksTocPage', () => {
  it('puts risks on the body start page when nothing precedes it', async () => {
    const document = createEmptyTaskDocument();
    const page = await estimateRisksTocPage({
      sections: [],
      meta: document.meta,
      testCases: [],
      settings,
    });
    expect(page).toBe(3);
  });

  it('puts risks on the next page after a short body, not one page per test', async () => {
    const document = createEmptyTaskDocument({
      meta: { testObject: 'Форма входа' },
    });
    const cases = [
      createEmptyTestCase({ number: '1', title: '1', goal: { html: '', plainText: 'Проверка' } }),
      createEmptyTestCase({ number: '2', title: '2', goal: { html: '', plainText: 'Повтор' } }),
    ];

    const page = await estimateRisksTocPage({
      sections: ['scenario'],
      meta: document.meta,
      testCases: cases,
      settings,
    });

    expect(page).toBe(4);
  });

  it('moves risks further when the body fills more than one page', async () => {
    const lines = Array.from({ length: 80 }, () => 'Строка общих положений.').join('\n');
    const document = createEmptyTaskDocument({
      meta: { generalProvisions: lines },
    });

    const page = await estimateRisksTocPage({
      sections: ['general'],
      meta: document.meta,
      testCases: [],
      settings,
    });

    expect(page).toBeGreaterThan(4);
  });
});
