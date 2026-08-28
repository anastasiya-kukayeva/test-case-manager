import mammoth from 'mammoth';
import {
  parsePmiTestCasesFromHtml,
  parsedPmiToTestCase,
  type ParsedPmiTestCase,
} from '@/infrastructure/import/parsePmiWordHtml';
import type { TestCase } from '@/domain/types';

export type DocxImportResult = {
  parsed: ParsedPmiTestCase[];
  testCases: TestCase[];
};

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Convert a .docx ArrayBuffer into PMI test-case drafts (appended numbers start at `startNumber`). */
export async function importTestCasesFromDocxBuffer(
  buffer: ArrayBuffer,
  startNumber: number,
): Promise<DocxImportResult> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const b64 = await image.read('base64');
        return { src: `data:${image.contentType};base64,${b64}` };
      }),
    },
  );

  const parsed = parsePmiTestCasesFromHtml(result.value);
  const testCases = parsed.map((item, index) =>
    parsedPmiToTestCase(item, String(startNumber + index)),
  );

  return { parsed, testCases };
}

export async function importTestCasesFromDocxBase64(
  base64: string,
  startNumber: number,
): Promise<DocxImportResult> {
  return importTestCasesFromDocxBuffer(base64ToArrayBuffer(base64), startNumber);
}
