import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createEmptyTaskDocument, createEmptyTestCase } from '@/domain/factories/createEntities';
import { DEFAULT_APP_SETTINGS } from '@/domain/types';
import { buildPsiCombinedDocx } from '@/templates/psi/buildDocx';

function zipEntry(data: Buffer, entryName: string): string {
  let offset = 0;
  while (offset + 30 < data.length) {
    if (data.readUInt32LE(offset) !== 0x04034b50) {
      break;
    }
    const method = data.readUInt16LE(offset + 8);
    const compressedSize = data.readUInt32LE(offset + 18);
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const start = offset + 30 + nameLength + extraLength;
    const compressed = data.subarray(start, start + compressedSize);
    if (name === entryName) {
      const raw = method === 0 ? compressed : inflateRawSync(compressed);
      return raw.toString('utf8');
    }
    offset = start + compressedSize;
  }
  throw new Error(`В docx нет ${entryName}`);
}

function task(name: string, title: string) {
  return createEmptyTaskDocument({
    meta: { name },
    testCases: [createEmptyTestCase({ title })],
  });
}

describe('buildPsiCombinedDocx', () => {
  it('starts each next module on a new page', async () => {
    const bytes = await buildPsiCombinedDocx({
      settings: DEFAULT_APP_SETTINGS.export,
      groups: [
        { moduleName: 'Платежи', documents: [task('Оплата', 'Успешная оплата')] },
        { moduleName: 'Карты', documents: [task('Выпуск', 'Выпуск карты')] },
      ],
    });

    const xml = zipEntry(Buffer.from(bytes), 'word/document.xml');
    const pageBreaks = xml.match(/w:type="page"/g) ?? [];
    expect(pageBreaks).toHaveLength(1);
    expect(xml).toContain('Платежи');
    expect(xml).toContain('Карты');
    const firstModule = Math.min(xml.indexOf('Платежи'), xml.indexOf('Карты'));
    const secondModule = Math.max(xml.indexOf('Платежи'), xml.indexOf('Карты'));
    expect(xml.indexOf('w:type="page"')).toBeGreaterThan(firstModule);
    expect(xml.indexOf('w:type="page"')).toBeLessThan(secondModule);
  });
});
