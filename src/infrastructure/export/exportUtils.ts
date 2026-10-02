function bulletMarker(depth: number): string {
  if (depth <= 0) {
    return '•';
  }
  if (depth === 1) {
    return '○';
  }
  if (depth === 2) {
    return '▪';
  }
  if (depth === 3) {
    return '▫';
  }
  return '▸';
}

function toAlphaIndex(index: number): string {
  let n = Math.max(1, index);
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

const ROMAN_PARTS: Array<[number, string]> = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

function toRomanIndex(index: number): string {
  let n = Math.max(1, index);
  let result = '';
  for (const [value, glyph] of ROMAN_PARTS) {
    while (n >= value) {
      result += glyph;
      n -= value;
    }
  }
  return result;
}

/** Same sequence as the editor: 1. / a. / i. / 1. / a. */
function formatOrderedMarker(index: number, depth: number, typeAttr: string | null): string {
  const explicit = typeAttr?.trim();
  const type =
    explicit && explicit !== '1' ? explicit : ['1', 'a', 'i', '1', 'a'][Math.min(Math.max(depth, 0), 4)];
  if (type === 'a') {
    return `${toAlphaIndex(index)}.`;
  }
  if (type === 'A') {
    return `${toAlphaIndex(index).toUpperCase()}.`;
  }
  if (type === 'i') {
    return `${toRomanIndex(index)}.`;
  }
  if (type === 'I') {
    return `${toRomanIndex(index).toUpperCase()}.`;
  }
  return `${index}.`;
}

function listStartIndex(list: HTMLElement): number {
  const raw = list.getAttribute('start');
  if (!raw) {
    return 1;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function directListItemText(li: HTMLElement): string {
  const parts: string[] = [];
  for (const child of Array.from(li.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push(child.textContent ?? '');
      continue;
    }
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    const tag = child.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol' || tag === 'img') {
      continue;
    }
    parts.push(child.textContent ?? '');
  }
  return parts.join(' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function listItemImageSources(li: HTMLElement): Array<{ dataUrl: string; alt?: string }> {
  const images: Array<{ dataUrl: string; alt?: string }> = [];
  const visit = (node: Node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    const tag = node.tagName.toLowerCase();
    if (tag === 'ul' || tag === 'ol') {
      return;
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (src.startsWith('data:image')) {
        images.push({ dataUrl: src, alt: node.getAttribute('alt') || undefined });
      }
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      visit(child);
    }
  };
  for (const child of Array.from(li.childNodes)) {
    visit(child);
  }
  return images;
}

function walkExportList(
  list: HTMLElement,
  depth: number,
  ordered: boolean,
  emitText: (text: string, preserveLeadingIndent: boolean) => void,
  emitImage?: (dataUrl: string, alt?: string) => void,
) {
  let index = ordered ? listStartIndex(list) : 1;
  const typeAttr = ordered ? list.getAttribute('type') : null;
  for (const child of Array.from(list.children)) {
    if (child.tagName.toLowerCase() !== 'li' || !(child instanceof HTMLElement)) {
      continue;
    }
    const indent = '  '.repeat(Math.max(0, depth));
    const text = directListItemText(child);
    const marker = ordered ? formatOrderedMarker(index, depth, typeAttr) : bulletMarker(depth);
    if (ordered) {
      index += 1;
    }
    emitText(text ? `${indent}${marker} ${text}` : `${indent}${marker}`, true);
    if (emitImage) {
      for (const image of listItemImageSources(child)) {
        emitImage(image.dataUrl, image.alt);
      }
    }
    for (const nested of Array.from(child.children)) {
      if (!(nested instanceof HTMLElement)) {
        continue;
      }
      const nestedTag = nested.tagName.toLowerCase();
      if (nestedTag === 'ul') {
        walkExportList(nested, depth + 1, false, emitText, emitImage);
      } else if (nestedTag === 'ol') {
        walkExportList(nested, depth + 1, true, emitText, emitImage);
      }
    }
  }
}

export function htmlToPlainParagraphs(html: string): string[] {
  if (!html.trim()) {
    return [];
  }

  const temporary = document.createElement('div');
  temporary.innerHTML = html;

  const blocks: string[] = [];
  const pushText = (text: string, options?: { preserveLeadingIndent?: boolean }) => {
    const withSpaces = text.replace(/\u00a0/g, ' ');
    if (options?.preserveLeadingIndent) {
      const leading = withSpaces.match(/^\s*/)?.[0] ?? '';
      const rest = withSpaces.slice(leading.length).replace(/\s+/g, ' ').trim();
      if (rest) {
        blocks.push(`${leading}${rest}`);
      }
      return;
    }
    const normalized = withSpaces.replace(/\s+/g, ' ').trim();
    if (normalized) {
      blocks.push(normalized);
    }
  };

  const walkList = (list: HTMLElement, depth: number, ordered: boolean) => {
    walkExportList(list, depth, ordered, (text, preserveLeadingIndent) => {
      pushText(text, { preserveLeadingIndent });
    });
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? '');
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === 'br') {
      blocks.push('');
      return;
    }

    if (tag === 'pre') {
      const text = node.textContent ?? '';
      for (const line of text.split(/\r?\n/)) {
        blocks.push(line);
      }
      return;
    }

    if (tag === 'ol') {
      walkList(node, 0, true);
      return;
    }

    if (tag === 'ul') {
      walkList(node, 0, false);
      return;
    }

    if (tag === 'li') {
      pushText(`• ${directListItemText(node)}`);
      return;
    }

    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote'].includes(tag)) {
      if (node.querySelector('ol, ul, br')) {
        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
        return;
      }
      pushText(node.textContent ?? '');
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };

  for (const child of Array.from(temporary.childNodes)) {
    walk(child);
  }

  if (blocks.length === 0) {
    pushText(temporary.textContent ?? '');
  }

  return blocks;
}

export type RichExportBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; dataUrl: string; alt?: string }
  | { type: 'code'; text: string; language?: string }
  | { type: 'log'; text: string };

/** Walk rich HTML preserving order of text, screenshots, code and logs. */
export function htmlToExportBlocks(html: string): RichExportBlock[] {
  if (!html.trim()) {
    return [];
  }

  const temporary = document.createElement('div');
  temporary.innerHTML = html;
  const blocks: RichExportBlock[] = [];

  const pushText = (text: string, options?: { preserveLeadingIndent?: boolean }) => {
    const withSpaces = text.replace(/\u00a0/g, ' ');
    if (options?.preserveLeadingIndent) {
      const leading = withSpaces.match(/^\s*/)?.[0] ?? '';
      const rest = withSpaces.slice(leading.length).replace(/\s+/g, ' ').trim();
      if (rest) {
        blocks.push({ type: 'text', text: `${leading}${rest}` });
      }
      return;
    }
    const normalized = withSpaces.replace(/\s+/g, ' ').trim();
    if (normalized) {
      blocks.push({ type: 'text', text: normalized });
    }
  };

  const walkList = (list: HTMLElement, depth: number, ordered: boolean) => {
    walkExportList(
      list,
      depth,
      ordered,
      (text, preserveLeadingIndent) => {
        pushText(text, { preserveLeadingIndent });
      },
      (dataUrl, alt) => {
        blocks.push({ type: 'image', dataUrl, alt });
      },
    );
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent ?? '');
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    const tag = node.tagName.toLowerCase();
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      if (src.startsWith('data:image')) {
        blocks.push({
          type: 'image',
          dataUrl: src,
          alt: node.getAttribute('alt') || undefined,
        });
      }
      return;
    }

    if (tag === 'br') {
      return;
    }

    if (tag === 'pre') {
      const code = node.querySelector('code');
      const isLog =
        node.classList.contains('tcm-log-block') ||
        node.getAttribute('data-type') === 'log' ||
        Boolean(code?.classList.contains('language-log'));
      const text = (code?.textContent ?? node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (isLog) {
        blocks.push({ type: 'log', text });
      } else {
        const className = code?.className || '';
        const languageMatch = className.match(/language-([a-z0-9_+-]+)/i);
        blocks.push({
          type: 'code',
          text,
          language: languageMatch?.[1],
        });
      }
      return;
    }

    if (tag === 'ol') {
      walkList(node, 0, true);
      return;
    }

    if (tag === 'ul') {
      walkList(node, 0, false);
      return;
    }

    if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'li'].includes(tag)) {
      if (node.querySelector('img, ol, ul, br, pre')) {
        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
        return;
      }
      pushText(node.textContent ?? '');
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };

  for (const child of Array.from(temporary.childNodes)) {
    walk(child);
  }

  return mergeAdjacentFenceBlocks(blocks);
}

function isFenceBlock(
  block: RichExportBlock,
): block is Extract<RichExportBlock, { type: 'code' | 'log' }> {
  return block.type === 'code' || block.type === 'log';
}

/** Join consecutive code/log blocks so the label is emitted once, not per line. */
export function mergeAdjacentFenceBlocks(blocks: RichExportBlock[]): RichExportBlock[] {
  const merged: RichExportBlock[] = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (isFenceBlock(block) && prev && prev.type === block.type) {
      if (block.type === 'code' && prev.type === 'code' && prev.language !== block.language) {
        merged.push({ ...block });
        continue;
      }
      if (isFenceBlock(prev)) {
        prev.text = `${prev.text.replace(/\n+$/, '')}\n${block.text.replace(/^\n+/, '')}`;
        continue;
      }
    }
    merged.push(isFenceBlock(block) ? { ...block } : block);
  }
  return merged;
}

export type DecodedImage = {
  bytes: Uint8Array;
  type: 'png' | 'jpg' | 'gif' | 'bmp';
  width: number;
  height: number;
};

export async function decodeDataUrlImage(dataUrl: string): Promise<DecodedImage | null> {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const rawType = match[1].toLowerCase();
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const type: DecodedImage['type'] =
    rawType.includes('jpeg') || rawType.includes('jpg')
      ? 'jpg'
      : rawType.includes('gif')
        ? 'gif'
        : rawType.includes('bmp')
          ? 'bmp'
          : 'png';

  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 800, height: image.naturalHeight || 600 });
    image.onerror = () => resolve({ width: 800, height: 600 });
    image.src = dataUrl;
  });

  return {
    bytes,
    type,
    width: size.width,
    height: size.height,
  };
}

/**
 * Stretch the image to `targetWidth` (may upscale), keeping aspect ratio.
 * If `maxHeight` is set and the result would be taller, scale down uniformly
 * so the image still fits on the page.
 */
export function scaleImageToWidth(
  width: number,
  height: number,
  targetWidth: number,
  maxHeight?: number,
): { width: number; height: number } {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const pageWidth = Math.max(targetWidth, 1);
  let ratio = pageWidth / safeWidth;
  if (maxHeight !== undefined && maxHeight > 0) {
    ratio = Math.min(ratio, maxHeight / safeHeight);
  }
  return {
    width: Math.max(1, Math.round(safeWidth * ratio)),
    height: Math.max(1, Math.round(safeHeight * ratio)),
  };
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Nesting depth (0–4) for lines produced by htmlToPlainParagraphs / htmlToExportBlocks.
 * Uses leading spaces first; bullet shape is a fallback if spaces were stripped.
 */
export function listDepthFromExportLine(text: string): number | undefined {
  const match = text.match(
    /^(\s*)(?:[•○▪▫▸]|(?:\d+|[a-z]{1,4}|[ivxlcdm]{1,8})\.)(?:\s|$)/i,
  );
  if (!match) {
    return undefined;
  }
  const spaces = match[1].replace(/\t/g, '  ').length;
  let depth = Math.min(4, Math.floor(spaces / 2));
  const marker = text.slice(match[1].length);
  if (marker.startsWith('○')) {
    depth = Math.max(depth, 1);
  } else if (marker.startsWith('▪')) {
    depth = Math.max(depth, 2);
  } else if (marker.startsWith('▫')) {
    depth = Math.max(depth, 3);
  } else if (marker.startsWith('▸')) {
    depth = Math.max(depth, 4);
  }
  return depth;
}
