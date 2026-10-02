import type { IncomingMessage, ServerResponse } from 'node:http';

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {} as T;
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function sendBytes(
  res: ServerResponse,
  status: number,
  bytes: Uint8Array,
  contentType: string,
  filename?: string,
): void {
  const headers: Record<string, string | number> = {
    'Content-Type': contentType,
    'Content-Length': bytes.byteLength,
  };
  if (filename) {
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  }
  res.writeHead(status, headers);
  res.end(bytes);
}
