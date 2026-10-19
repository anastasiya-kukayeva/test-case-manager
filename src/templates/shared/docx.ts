import {
  AlignmentType,
  ExternalHyperlink,
  Footer,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  TextRun,
  type FileChild,
  type IRunOptions,
} from 'docx';
import type { RichTextContent } from '@/domain/types';
import {
  decodeDataUrlImage,
  htmlToExportBlocks,
  listDepthFromExportLine,
  scaleImageToWidth,
  type ExportTextRun,
} from '@/infrastructure/export/exportUtils';

export const FONT = 'Times New Roman';

/** A4 in twips (DXA), matching OOXML / Word defaults. */
export const PAGE_WIDTH_TWIPS = 11906;
export const PAGE_HEIGHT_TWIPS = 16838;
export const PAGE_MARGIN = {
  top: 850,
  bottom: 1134,
  left: 1134,
  right: 850,
} as const;

/** ImageRun transformation uses CSS pixels at 96 DPI (1 px = 15 twips). */
const TWIPS_PER_PIXEL = 15;
export const PAGE_CONTENT_WIDTH_PX = Math.max(
  1,
  Math.round((PAGE_WIDTH_TWIPS - PAGE_MARGIN.left - PAGE_MARGIN.right) / TWIPS_PER_PIXEL),
);
export const PAGE_CONTENT_HEIGHT_PX = Math.max(
  1,
  Math.round((PAGE_HEIGHT_TWIPS - PAGE_MARGIN.top - PAGE_MARGIN.bottom) / TWIPS_PER_PIXEL),
);

/** docx sizes are in half-points: 24 = 12 pt */
export const SIZE_TITLE = 36;
export const SIZE_TOC_TITLE = 32;
export const SIZE_TOC = 28;
export const SIZE_H2 = 28;
export const SIZE_BODY = 24;
export const SIZE_SMALL = 20;
export const SIZE_FOOTER = 20;

export const PAGE_CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - PAGE_MARGIN.left - PAGE_MARGIN.right;

export function run(text: string, options: IRunOptions = {}): TextRun {
  return new TextRun({
    font: FONT,
    size: SIZE_BODY,
    ...options,
    text,
  });
}

export function pageBreak(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

export function hasRichText(value: RichTextContent | undefined): boolean {
  return Boolean(value?.plainText?.trim() || value?.html?.trim());
}

function styledRun(piece: ExportTextRun): TextRun {
  return run(piece.text || ' ', {
    bold: piece.bold || undefined,
    italics: piece.italics || undefined,
    underline: piece.underline ? {} : undefined,
    color: piece.color,
    shading: piece.highlight ? { type: ShadingType.CLEAR, fill: piece.highlight } : undefined,
  });
}

function trimLeadingRuns(runs: ExportTextRun[]): ExportTextRun[] {
  let skipping = true;
  const next: ExportTextRun[] = [];
  for (const piece of runs) {
    let text = piece.text;
    if (skipping) {
      text = text.trimStart();
      if (text.length > 0) {
        skipping = false;
      }
    }
    if (text) {
      next.push({ ...piece, text });
    }
  }
  return next.length > 0 ? next : [{ text: ' ' }];
}

/** Indent nested list lines exported as "  • item" / "    ▪ item" / "▴ item". */
function listLineIndentLeft(text: string): number | undefined {
  const depth = listDepthFromExportLine(text);
  if (depth === undefined) {
    return undefined;
  }
  return 360 + depth * 360;
}

export function exportRunsToChildren(runs: ExportTextRun[]): Array<TextRun | ExternalHyperlink> {
  return runs.map((piece) => {
    const textRun = styledRun(
      piece.link ? { ...piece, underline: true, color: piece.color ?? '0563C1' } : piece,
    );
    if (!piece.link) {
      return textRun;
    }
    return new ExternalHyperlink({
      link: piece.link,
      children: [textRun],
    });
  });
}

function paragraphFromRuns(
  text: string,
  runs: ExportTextRun[],
  options?: { prefix?: TextRun[]; spacingBefore?: number; alignLeft?: boolean },
): Paragraph {
  const indentLeft = listLineIndentLeft(text);
  const visible = indentLeft !== undefined ? trimLeadingRuns(runs) : runs;
  const body = exportRunsToChildren(visible.length > 0 ? visible : [{ text: text || ' ' }]);
  return new Paragraph({
    alignment: options?.alignLeft ? AlignmentType.LEFT : AlignmentType.BOTH,
    spacing: options?.spacingBefore ? { before: options.spacingBefore, after: 60 } : { after: 60 },
    indent: indentLeft !== undefined ? { left: indentLeft } : undefined,
    children: [...(options?.prefix ?? []), ...body],
  });
}

function stepNumberParagraph(leadIn: string, spacingBefore?: number): Paragraph {
  return new Paragraph({
    spacing: { before: spacingBefore ?? 0, after: 40 },
    children: [run(leadIn, { bold: true })],
  });
}

export function bodyLines(
  text: string,
  options?: { indent?: boolean; indentLeft?: number },
): Paragraph[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0));

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => {
    const indentLeft =
      options?.indentLeft ?? (options?.indent ? 360 : undefined) ?? listLineIndentLeft(line);
    return new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { after: 60 },
      indent: indentLeft !== undefined ? { left: indentLeft } : undefined,
      children: [run(line.trimStart() || ' ')],
    });
  });
}

export function fromRichText(content: RichTextContent | undefined): Paragraph[] {
  if (!content) {
    return [];
  }
  const html = content.html?.trim();
  if (html) {
    const parts = htmlToExportBlocks(html).flatMap((block) =>
      block.type === 'text' ? [paragraphFromRuns(block.text, block.runs)] : [],
    );
    if (parts.length > 0) {
      return parts;
    }
  }
  return bodyLines(content.plainText || '');
}

export async function imageParagraphs(
  dataUrl: string,
  maxWidthPx = PAGE_CONTENT_WIDTH_PX,
  maxHeightPx = PAGE_CONTENT_HEIGHT_PX,
): Promise<Paragraph[]> {
  const decoded = await decodeDataUrlImage(dataUrl);
  if (!decoded) {
    return [
      new Paragraph({
        children: [
          run('[Не удалось встроить изображение]', {
            italics: true,
            color: 'AA0000',
            size: SIZE_SMALL,
          }),
        ],
      }),
    ];
  }

  const size = scaleImageToWidth(decoded.width, decoded.height, maxWidthPx, maxHeightPx);
  return [
    new Paragraph({
      spacing: { before: 100, after: 120 },
      children: [
        new ImageRun({
          type: decoded.type,
          data: decoded.bytes,
          transformation: size,
          altText: {
            title: 'screenshot',
            description: 'Скриншот',
            name: 'screenshot',
          },
        }),
      ],
    }),
  ];
}

export type RichContentExportOptions = {
  includeImages: boolean;
  includeCodeBlocks: boolean;
  includeLogs: boolean;
  /** Shown when the block has no text. PMI uses an em dash. */
  emptyText?: string;
  imageMaxWidthPx?: number;
  /** Caps screenshot height. When omitted, the portrait page content height is used. */
  imageMaxHeightPx?: number;
  /**
   * Step number, for example "1.".
   * Text of the first paragraph continues on the same line.
   * A screenshot, code block or log starts on the next line.
   */
  leadIn?: string;
  /** Space before the first paragraph of this block. */
  spacingBefore?: number;
};

export async function fromRichContent(
  content: RichTextContent | undefined,
  options: RichContentExportOptions,
): Promise<FileChild[]> {
  const emptyText = options.emptyText ?? '—';
  const leadIn = options.leadIn?.trim() || undefined;
  const spacingBefore = options.spacingBefore;

  if (!content) {
    return leadIn ? [stepNumberParagraph(leadIn, spacingBefore)] : bodyLines(emptyText);
  }

  const html = content.html?.trim() ?? '';
  if (!html) {
    if (!leadIn) {
      const plain = fromRichText(content);
      return plain.length > 0 ? plain : bodyLines(emptyText);
    }
    return plainContentWithLead(content.plainText || '', {
      leadIn,
      spacingBefore,
      emptyText,
    });
  }

  const blocks = htmlToExportBlocks(html);
  if (blocks.length === 0) {
    if (!leadIn) {
      return bodyLines(content.plainText || emptyText);
    }
    return plainContentWithLead(content.plainText || '', {
      leadIn,
      spacingBefore,
      emptyText,
    });
  }

  const out: FileChild[] = [];
  let pendingLead = leadIn;
  let pendingSpacing = spacingBefore;

  const takeSpacing = () => {
    const value = pendingSpacing;
    pendingSpacing = undefined;
    return value;
  };

  const pushLeadOnOwnLine = () => {
    if (!pendingLead) {
      return;
    }
    out.push(stepNumberParagraph(pendingLead, takeSpacing()));
    pendingLead = undefined;
  };

  for (const block of blocks) {
    if (block.type === 'text') {
      const prefix = pendingLead;
      pendingLead = undefined;
      const before = out.length === 0 ? takeSpacing() : undefined;
      out.push(
        paragraphFromRuns(
          block.text,
          block.runs,
          prefix
            ? {
                prefix: [run(prefix, { bold: true }), run(' ')],
                spacingBefore: before,
                alignLeft: true,
              }
            : before
              ? { spacingBefore: before }
              : undefined,
        ),
      );
      continue;
    }

    if (block.type === 'image') {
      if (!options.includeImages) {
        continue;
      }
      pushLeadOnOwnLine();
      out.push(
        ...(await imageParagraphs(
          block.dataUrl,
          options.imageMaxWidthPx,
          options.imageMaxHeightPx,
        )),
      );
      continue;
    }

    if (block.type === 'code') {
      if (!options.includeCodeBlocks) {
        continue;
      }
      pushLeadOnOwnLine();
      out.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [run(block.language ? `Код (${block.language}):` : 'Код:', { bold: true })],
        }),
      );
      for (const line of (block.text || '—').split(/\r?\n/)) {
        out.push(
          new Paragraph({
            spacing: { after: 20 },
            children: [run(line || ' ', { font: 'Courier New', size: SIZE_SMALL })],
          }),
        );
      }
      continue;
    }

    if (block.type === 'log') {
      if (!options.includeLogs) {
        continue;
      }
      pushLeadOnOwnLine();
      out.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [run('Лог:', { bold: true })],
        }),
      );
      for (const line of (block.text || '—').split(/\r?\n/)) {
        out.push(
          new Paragraph({
            spacing: { after: 20 },
            children: [run(line || ' ', { font: 'Courier New', size: SIZE_SMALL })],
          }),
        );
      }
    }
  }

  if (pendingLead) {
    out.push(stepNumberParagraph(pendingLead, takeSpacing()));
  }
  return out.length > 0 ? out : bodyLines(emptyText);
}

function plainContentWithLead(
  text: string,
  options: { leadIn?: string; spacingBefore?: number; emptyText: string },
): FileChild[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!options.leadIn) {
    return lines.length > 0 ? bodyLines(lines.join('\n')) : bodyLines(options.emptyText);
  }
  if (lines.length === 0) {
    return [stepNumberParagraph(options.leadIn, options.spacingBefore)];
  }

  const [first, ...rest] = lines;
  return [
    paragraphFromRuns(first, [{ text: first }], {
      prefix: [run(options.leadIn, { bold: true }), run(' ')],
      spacingBefore: options.spacingBefore,
      alignLeft: true,
    }),
    ...bodyLines(rest.join('\n')),
  ];
}

export function pageNumberFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            font: FONT,
            size: SIZE_FOOTER,
            children: [PageNumber.CURRENT],
          }),
        ],
      }),
    ],
  });
}

export function pageOfFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          run('Страница ', { size: SIZE_FOOTER }),
          new TextRun({
            font: FONT,
            size: SIZE_FOOTER,
            children: [PageNumber.CURRENT],
          }),
          run(' из ', { size: SIZE_FOOTER }),
          new TextRun({
            font: FONT,
            size: SIZE_FOOTER,
            children: [PageNumber.TOTAL_PAGES],
          }),
        ],
      }),
    ],
  });
}
