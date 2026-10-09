import mammoth from 'mammoth';
import {
  parseRegressionReportHtml,
  type ParsedRegressionReportCase,
} from '@/infrastructure/import/parseRegressionReportHtml';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

/** Read a regression-report .docx and return one case per table row. */
export async function importRegressionReportFromDocxBuffer(
  buffer: ArrayBuffer,
): Promise<ParsedRegressionReportCase[]> {
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return parseRegressionReportHtml(result.value);
}

export async function importRegressionReportFromDocxBase64(
  base64: string,
): Promise<ParsedRegressionReportCase[]> {
  return importRegressionReportFromDocxBuffer(base64ToArrayBuffer(base64));
}
