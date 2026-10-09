function bulletMarker(depth: number): string {
  if (depth <= 0) {
    return '•';
  }
  if (depth === 1) {
    return '▪';
  }
  if (depth === 2) {
    return '▴';
  }
  if (depth === 3) {
    return '◦';
  }
  return '◆';
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

export type ExportTextStyle = {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  /** Font color, RRGGBB without a hash. */
  color?: string;
  /** Background color, RRGGBB without a hash. */
  highlight?: string;
};

export type ExportTextRun = {
  text: string;
} & ExportTextStyle;

function sameExportStyle(left: ExportTextStyle, right: ExportTextStyle): boolean {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italics) === Boolean(right.italics) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    (left.color ?? '') === (right.color ?? '') &&
    (left.highlight ?? '') === (right.highlight ?? '')
  );
}

function pushExportRun(runs: ExportTextRun[], text: string, style: ExportTextStyle) {
  if (!text) {
    return;
  }
  const previous = runs[runs.length - 1];
  if (previous && sameExportStyle(previous, style)) {
    previous.text += text;
    return;
  }
  runs.push({ text, ...style });
}

/** CSS color to Word hex (RRGGBB). Named colors used by Word highlight are included. */
export function cssColorToHex(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const raw = value.trim().toLowerCase();
  if (!raw || raw === 'inherit' || raw === 'transparent' || raw === 'currentcolor') {
    return undefined;
  }
  if (raw.startsWith('#')) {
    const hex = raw.slice(1);
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return hex
        .split('')
        .map((char) => char + char)
        .join('')
        .toUpperCase();
    }
    if (/^[0-9a-f]{6}$/.test(hex)) {
      return hex.toUpperCase();
    }
    return undefined;
  }
  const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  const named: Record<string, string> = {
    black: '000000',
    white: 'FFFFFF',
    red: 'FF0000',
    green: '00FF00',
    blue: '0000FF',
    yellow: 'FFFF00',
    cyan: '00FFFF',
    magenta: 'FF00FF',
    orange: 'FFA500',
    gray: '808080',
    grey: '808080',
    darkgray: 'A9A9A9',
    darkgrey: 'A9A9A9',
    lightgray: 'D3D3D3',
    lightgrey: 'D3D3D3',
    darkblue: '00008B',
    darkcyan: '008B8B',
    darkgreen: '006400',
    darkmagenta: '8B008B',
    darkred: '8B0000',
    darkyellow: 'B8860B',
  };
  return named[raw];
}

function styleDecl(element: HTMLElement, name: string): string {
  const raw = element.getAttribute('style') ?? '';
  const match = raw.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim() ?? '';
}

function withElementStyle(element: HTMLElement, parent: ExportTextStyle): ExportTextStyle {
  const next: ExportTextStyle = { ...parent };
  const tag = element.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') {
    next.bold = true;
  }
  if (tag === 'em' || tag === 'i') {
    next.italics = true;
  }
  if (tag === 'u') {
    next.underline = true;
  }

  const weight = (element.style.fontWeight || styleDecl(element, 'font-weight')).trim();
  if (/^(bold(er)?|[5-9]\d{2,})$/.test(weight)) {
    next.bold = true;
  } else if (weight === 'normal' || weight === '400') {
    delete next.bold;
  }

  const fontStyle = (element.style.fontStyle || styleDecl(element, 'font-style')).trim();
  if (fontStyle === 'italic' || fontStyle === 'oblique') {
    next.italics = true;
  } else if (fontStyle === 'normal') {
    delete next.italics;
  }

  const decoration = `${element.style.textDecorationLine} ${element.style.textDecoration} ${styleDecl(element, 'text-decoration-line')} ${styleDecl(element, 'text-decoration')}`;
  if (decoration.includes('underline')) {
    next.underline = true;
  }

  const color = cssColorToHex(
    element.style.color || styleDecl(element, 'color') || (tag === 'font' ? element.getAttribute('color') : ''),
  );
  if (color) {
    next.color = color;
  }

  const highlight = cssColorToHex(
    element.style.backgroundColor ||
      styleDecl(element, 'background-color') ||
      element.getAttribute('data-color') ||
      '',
  );
  if (highlight && (tag === 'mark' || styleDecl(element, 'background-color') || element.style.backgroundColor)) {
    next.highlight = highlight;
  }
  return next;
}

function normalizeExportRuns(runs: ExportTextRun[], preserveLeadingIndent: boolean): ExportTextRun[] {
  const cleaned = runs
    .map((run) => ({
      ...run,
      text: run.text.replace(/\u00a0/g, ' ').replace(/[ \t\f\v]+/g, ' '),
    }))
    .filter((run) => run.text.length > 0);
  if (!preserveLeadingIndent && cleaned[0]) {
    cleaned[0] = { ...cleaned[0], text: cleaned[0].text.trimStart() };
  }
  const last = cleaned[cleaned.length - 1];
  if (last) {
    cleaned[cleaned.length - 1] = { ...last, text: last.text.trimEnd() };
  }
  return cleaned.filter((run) => run.text.length > 0);
}

function walkExportList(
  list: HTMLElement,
  depth: number,
  ordered: boolean,
  emitText: (runs: ExportTextRun[], preserveLeadingIndent: boolean) => void,
  emitImage?: (dataUrl: string, alt?: string) => void,
) {
  let index = ordered ? listStartIndex(list) : 1;
  const typeAttr = ordered ? list.getAttribute('type') : null;
  for (const child of Array.from(list.children)) {
    if (child.tagName.toLowerCase() !== 'li' || !(child instanceof HTMLElement)) {
      continue;
    }
    const indent = '  '.repeat(Math.max(0, depth));
    const marker = ordered ? formatOrderedMarker(index, depth, typeAttr) : bulletMarker(depth);
    if (ordered) {
      index += 1;
    }
    const contentRuns: ExportTextRun[] = [];
    const images: Array<{ dataUrl: string; alt?: string }> = [];
    const nested: HTMLElement[] = [];
    for (const node of Array.from(child.childNodes)) {
      collectInline(node, {}, contentRuns, nested, images);
    }
    emitText([{ text: `${indent}${marker} ` }, ...contentRuns], true);
    if (emitImage) {
      for (const image of images) {
        emitImage(image.dataUrl, image.alt);
      }
    }
    for (const nestedList of nested) {
      const nestedTag = nestedList.tagName.toLowerCase();
      if (nestedTag === 'ul') {
        walkExportList(nestedList, depth + 1, false, emitText, emitImage);
      } else if (nestedTag === 'ol') {
        walkExportList(nestedList, depth + 1, true, emitText, emitImage);
      }
    }
  }
}

function collectInline(
  node: Node,
  style: ExportTextStyle,
  runs: ExportTextRun[],
  nestedLists: HTMLElement[],
  images: Array<{ dataUrl: string; alt?: string }>,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    pushExportRun(runs, node.textContent ?? '', style);
    return;
  }
  if (!(node instanceof HTMLElement)) {
    return;
  }
  const tag = node.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') {
    nestedLists.push(node);
    return;
  }
  if (tag === 'img') {
    const src = node.getAttribute('src') || '';
    if (src.startsWith('data:image')) {
      images.push({ dataUrl: src, alt: node.getAttribute('alt') || undefined });
    }
    return;
  }
  if (tag === 'br') {
    pushExportRun(runs, ' ', style);
    return;
  }
  if (tag === 'pre') {
    return;
  }
  const next = withElementStyle(node, style);
  for (const child of Array.from(node.childNodes)) {
    collectInline(child, next, runs, nestedLists, images);
  }
}

export type RichExportBlock =
  | { type: 'text'; text: string; runs: ExportTextRun[] }
  | { type: 'image'; dataUrl: string; alt?: string }
  | { type: 'code'; text: string; language?: string }
  | { type: 'log'; text: string };

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'li']);

/** Walk rich HTML preserving order of formatted text, screenshots, code and logs. */
export function htmlToExportBlocks(html: string): RichExportBlock[] {
  if (!html.trim()) {
    return [];
  }

  const temporary = document.createElement('div');
  temporary.innerHTML = html;
  const blocks: RichExportBlock[] = [];

  const pushRuns = (runs: ExportTextRun[], preserveLeadingIndent = false) => {
    const normalized = normalizeExportRuns(runs, preserveLeadingIndent);
    const text = normalized.map((run) => run.text).join('');
    if (!text.trim()) {
      return;
    }
    blocks.push({ type: 'text', text, runs: normalized });
  };

  const pushPre = (node: HTMLElement) => {
    const code = node.querySelector('code');
    const isLog =
      node.classList.contains('tcm-log-block') ||
      node.getAttribute('data-type') === 'log' ||
      Boolean(code?.classList.contains('language-log'));
    const text = (code?.textContent ?? node.textContent ?? '').replace(/\u00a0/g, ' ');
    if (isLog) {
      blocks.push({ type: 'log', text });
      return;
    }
    const className = code?.className || '';
    const languageMatch = className.match(/language-([a-z0-9_+-]+)/i);
    blocks.push({
      type: 'code',
      text,
      language: languageMatch?.[1],
    });
  };

  const walkList = (list: HTMLElement, depth: number, ordered: boolean) => {
    walkExportList(
      list,
      depth,
      ordered,
      (runs, preserveLeadingIndent) => {
        pushRuns(runs, preserveLeadingIndent);
      },
      (dataUrl, alt) => {
        blocks.push({ type: 'image', dataUrl, alt });
      },
    );
  };

  const consumeInlineBlock = (element: HTMLElement) => {
    let runs: ExportTextRun[] = [];
    const flush = () => {
      pushRuns(runs);
      runs = [];
    };
    const visit = (node: Node, style: ExportTextStyle) => {
      if (node.nodeType === Node.TEXT_NODE) {
        pushExportRun(runs, node.textContent ?? '', style);
        return;
      }
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        flush();
        return;
      }
      if (tag === 'ul') {
        flush();
        walkList(node, 0, false);
        return;
      }
      if (tag === 'ol') {
        flush();
        walkList(node, 0, true);
        return;
      }
      if (tag === 'img') {
        flush();
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
      if (tag === 'pre') {
        flush();
        pushPre(node);
        return;
      }
      const next = withElementStyle(node, style);
      for (const child of Array.from(node.childNodes)) {
        visit(child, next);
      }
    };
    for (const child of Array.from(element.childNodes)) {
      visit(child, withElementStyle(element, {}));
    }
    flush();
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pushRuns([{ text: node.textContent ?? '' }]);
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
    if (tag === 'pre') {
      pushPre(node);
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
    if (BLOCK_TAGS.has(tag)) {
      const hasNestedBlock = Boolean(node.querySelector('p, div, h1, h2, h3, h4, blockquote, ul, ol, pre'));
      if (hasNestedBlock && tag !== 'li') {
        for (const child of Array.from(node.childNodes)) {
          walk(child);
        }
        return;
      }
      if (tag === 'li') {
        walkList(wrapLoneListItem(node), 0, false);
        return;
      }
      consumeInlineBlock(node);
      return;
    }
    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };

  for (const child of Array.from(temporary.childNodes)) {
    walk(child);
  }

  if (blocks.length === 0 && temporary.textContent?.trim()) {
    pushRuns([{ text: temporary.textContent }]);
  }

  return mergeAdjacentFenceBlocks(blocks);
}

function wrapLoneListItem(item: HTMLElement): HTMLElement {
  const list = document.createElement('ul');
  list.append(item.cloneNode(true));
  return list;
}

/** Plain lines derived from the formatted export blocks. */
export function htmlToPlainParagraphs(html: string): string[] {
  const lines: string[] = [];
  for (const block of htmlToExportBlocks(html)) {
    if (block.type === 'text') {
      lines.push(block.text);
      continue;
    }
    if (block.type === 'code' || block.type === 'log') {
      lines.push(...block.text.split(/\r?\n/));
    }
  }
  return lines;
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
    /^(\s*)(?:[•▪▴◦◆]|(?:\d+|[a-z]{1,4}|[ivxlcdm]{1,8})\.)(?:\s|$)/i,
  );
  if (!match) {
    return undefined;
  }
  const spaces = match[1].replace(/\t/g, '  ').length;
  let depth = Math.min(4, Math.floor(spaces / 2));
  const marker = text.slice(match[1].length);
  if (marker.startsWith('▪')) {
    depth = Math.max(depth, 1);
  } else if (marker.startsWith('▴')) {
    depth = Math.max(depth, 2);
  } else if (marker.startsWith('◦')) {
    depth = Math.max(depth, 3);
  } else if (marker.startsWith('◆')) {
    depth = Math.max(depth, 4);
  }
  return depth;
}
