import {
  AlignmentType,
  Bookmark,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LeaderType,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
  type FileChild,
  type IRunOptions,
} from 'docx';
import type { ExportSettings, NamedLink, RichTextContent, TaskDocument, TestCase } from '@/domain/types';
import { isImageAttachment } from '@/domain/types/attachment';
import {
  decodeDataUrlImage,
  htmlToExportBlocks,
  htmlToPlainParagraphs,
  listDepthFromExportLine,
  scaleImageToWidth,
} from '@/infrastructure/export/exportUtils';
import { inlineVerificationAttachments } from '@/application/testCases/testCaseFormMapper';

export type PmiDocxExportContext = {
  document: TaskDocument;
  settings: ExportSettings;
};

const FONT = 'Times New Roman';

/** A4 in twips (DXA), matching OOXML / Word defaults. */
const PAGE_WIDTH_TWIPS = 11906;
const PAGE_HEIGHT_TWIPS = 16838;
const PAGE_MARGIN = {
  top: 850,
  bottom: 1134,
  left: 1134,
  right: 850,
} as const;

/** ImageRun transformation uses CSS pixels at 96 DPI (1 px = 15 twips). */
const TWIPS_PER_PIXEL = 15;
const PAGE_CONTENT_WIDTH_PX = Math.max(
  1,
  Math.round((PAGE_WIDTH_TWIPS - PAGE_MARGIN.left - PAGE_MARGIN.right) / TWIPS_PER_PIXEL),
);
const PAGE_CONTENT_HEIGHT_PX = Math.max(
  1,
  Math.round((PAGE_HEIGHT_TWIPS - PAGE_MARGIN.top - PAGE_MARGIN.bottom) / TWIPS_PER_PIXEL),
);

/** docx sizes are in half-points: 24 = 12 pt */
const SIZE_TITLE = 36; // 18 pt
const SIZE_TOC_TITLE = 32; // 16 pt
const SIZE_TOC = 28; // 14 pt
const SIZE_H2 = 28; // 14 pt
const SIZE_BODY = 24; // 12 pt
const SIZE_SMALL = 20; // 10 pt
const SIZE_FOOTER = 20; // 10 pt

type TocEntry = {
  id: string;
  title: string;
  /** Absolute page number in the generated document */
  page: number;
};

/** Page 1 = title, page 2 = TOC, body starts at page 3 (sections flow continuously). */
const BODY_START_PAGE = 3;

function run(text: string, options: IRunOptions = {}): TextRun {
  return new TextRun({
    font: FONT,
    size: SIZE_BODY,
    ...options,
    text,
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    // Push title toward vertical middle of the first page
    spacing: { before: 4200, after: 300 },
    children: [run(text, { bold: true, size: SIZE_TITLE })],
  });
}

function sectionHeading(text: string, bookmarkId: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [
      new Bookmark({
        id: bookmarkId,
        children: [run(text, { bold: true, size: SIZE_H2 })],
      }),
    ],
  });
}

function tocParagraphs(entries: TocEntry[]): FileChild[] {
  if (entries.length === 0) {
    return [];
  }

  const blocks: FileChild[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 280 },
      children: [run('Оглавление', { bold: true, size: SIZE_TOC_TITLE })],
    }),
  ];

  for (const [index, entry] of entries.entries()) {
    blocks.push(
      new Paragraph({
        spacing: { after: 140 },
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
            leader: LeaderType.DOT,
          },
        ],
        children: [
          new InternalHyperlink({
            anchor: entry.id,
            children: [
              run(`${index + 1}. ${entry.title}`, {
                size: SIZE_TOC,
                color: '0563C1',
                underline: {},
              }),
            ],
          }),
          new TextRun({
            children: [new Tab()],
            font: FONT,
            size: SIZE_TOC,
          }),
          run(String(entry.page), { size: SIZE_TOC, bold: true }),
        ],
      }),
    );
  }

  return blocks;
}

function labelParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 60 },
    children: [run(text, { bold: true })],
  });
}

function bodyLines(text: string, options?: { indent?: boolean; indentLeft?: number }): Paragraph[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, arr) => line.length > 0 || (index > 0 && arr[index - 1].length > 0));

  if (lines.length === 0) {
    return [];
  }

  return lines.map((line) => {
    const indentLeft =
      options?.indentLeft ??
      (options?.indent ? 360 : undefined) ??
      listLineIndentLeft(line);
    return new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { after: 60 },
      indent: indentLeft !== undefined ? { left: indentLeft } : undefined,
      children: [run(line.trimStart() || ' ')],
    });
  });
}

/** Indent nested list lines exported as "  • item" / "    ○ item" / "▪ item". */
function listLineIndentLeft(text: string): number | undefined {
  const depth = listDepthFromExportLine(text);
  if (depth === undefined) {
    return undefined;
  }
  // 0.25" base + 0.25" per nesting level (matches editor padding-left nesting).
  return 360 + depth * 360;
}

function fromRichText(content: RichTextContent | undefined): Paragraph[] {
  if (!content) {
    return [];
  }
  const html = content.html?.trim();
  if (html) {
    const parts = htmlToPlainParagraphs(html);
    return parts.flatMap((part) => bodyLines(part));
  }
  return bodyLines(content.plainText || '');
}

async function fromRichContent(
  content: RichTextContent | undefined,
  options: { includeImages: boolean; includeCodeBlocks: boolean; includeLogs: boolean },
): Promise<FileChild[]> {
  if (!content) {
    return bodyLines('—');
  }

  const html = content.html?.trim();
  if (!html) {
    const plain = fromRichText(content);
    return plain.length > 0 ? plain : bodyLines('—');
  }

  const blocks = htmlToExportBlocks(html);
  if (blocks.length === 0) {
    return bodyLines(content.plainText || '—');
  }

  const out: FileChild[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      out.push(...bodyLines(block.text));
      continue;
    }

    if (block.type === 'image') {
      if (options.includeImages) {
        out.push(...(await imageParagraphs(block.dataUrl)));
      }
      continue;
    }

    if (block.type === 'code') {
      if (!options.includeCodeBlocks) {
        continue;
      }
      out.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            run(block.language ? `Код (${block.language}):` : 'Код:', { bold: true }),
          ],
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
  return out.length > 0 ? out : bodyLines('—');
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasNamedLinks(links: NamedLink[] | undefined): boolean {
  return Boolean(links?.some((link) => link.url.trim() || link.title.trim()));
}

function hasTestObjectSection(meta: TaskDocument['meta']): boolean {
  return hasText(meta.testObject) || hasNamedLinks(meta.testObjectLinks);
}

function normalizeExportUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  // Local / UNC paths stay as-is (exported as plain text, not hyperlinks).
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/** Only http(s)/mailto become Word hyperlinks — file paths stay plain text. */
function isWebHyperlink(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url.trim());
}

function testObjectParagraphs(text: string, links: NamedLink[] | undefined): Paragraph[] {
  const out: Paragraph[] = [...bodyLines(text)];

  for (const link of links ?? []) {
    const href = normalizeExportUrl(link.url);
    if (!href && !link.title.trim()) {
      continue;
    }
    const label = link.title.trim() || href;

    // Avoid HYPERLINK fields to local/UNC files — Word treats them as external document refs.
    if (!href || !isWebHyperlink(href)) {
      const plain = href && label !== href ? `${label}: ${href}` : label;
      out.push(
        new Paragraph({
          alignment: AlignmentType.BOTH,
          spacing: { after: 60 },
          children: [run(plain)],
        }),
      );
      continue;
    }

    out.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { after: 60 },
        children: [
          new ExternalHyperlink({
            link: href,
            children: [
              run(label, {
                color: '0563C1',
                underline: {},
              }),
            ],
          }),
        ],
      }),
    );
  }

  return out;
}

function hasRichText(value: RichTextContent | undefined): boolean {
  return Boolean(value?.plainText?.trim() || value?.html?.trim());
}

function outcomeLabel(testCase: TestCase): string {
  if (testCase.testOutcome === 'passed') {
    return 'успешно';
  }
  if (testCase.testOutcome === 'failed') {
    return 'неуспешно';
  }
  return 'не выбран';
}

async function imageParagraphs(dataUrl: string): Promise<Paragraph[]> {
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

  const size = scaleImageToWidth(
    decoded.width,
    decoded.height,
    PAGE_CONTENT_WIDTH_PX,
    PAGE_CONTENT_HEIGHT_PX,
  );
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

/**
 * PMI-style Word export matching the methodology sample:
 * title → filled task sections → scenario with test cases.
 */
export async function buildPmiDocx(context: PmiDocxExportContext): Promise<Uint8Array> {
  const { document, settings } = context;
  const meta = document.meta;
  const children: FileChild[] = [];

  const taskName = meta.name?.trim() || 'Без названия';
  children.push(titleParagraph(taskName));
  children.push(pageBreak());

  const sectionPlan: Array<{ id: string; title: string; kind: string }> = [];
  if (hasTestObjectSection(meta)) {
    sectionPlan.push({ id: 'toc-object', title: 'Объект испытаний', kind: 'object' });
  }
  if (hasRichText(meta.testGoal)) {
    sectionPlan.push({ id: 'toc-goal', title: 'Цель испытаний', kind: 'goal' });
  }
  if (hasText(meta.generalProvisions)) {
    sectionPlan.push({ id: 'toc-general', title: 'Общие положения', kind: 'general' });
  }
  if (hasRichText(meta.functionalRequirements)) {
    sectionPlan.push({
      id: 'toc-functional',
      title: 'Требования к функциональности',
      kind: 'functional',
    });
  }
  if (document.testCases.length > 0) {
    sectionPlan.push({ id: 'toc-scenario', title: 'Сценарий испытаний', kind: 'scenario' });
  }

  // Body flows on one continuous sequence starting at page 3.
  const tocEntries: TocEntry[] = sectionPlan.map((section) => ({
    id: section.id,
    title: section.title,
    page: BODY_START_PAGE,
  }));

  if (tocEntries.length > 0) {
    children.push(...tocParagraphs(tocEntries));
    children.push(pageBreak());
  }

  for (const section of sectionPlan) {
    children.push(sectionHeading(section.title, section.id));

    if (section.kind === 'object') {
      children.push(...testObjectParagraphs(meta.testObject, meta.testObjectLinks));
      continue;
    }
    if (section.kind === 'goal') {
      children.push(...fromRichText(meta.testGoal));
      continue;
    }
    if (section.kind === 'general') {
      children.push(...bodyLines(meta.generalProvisions));
      continue;
    }
    if (section.kind === 'functional') {
      children.push(...fromRichText(meta.functionalRequirements));
      continue;
    }
    if (section.kind === 'scenario') {
      for (let i = 0; i < document.testCases.length; i += 1) {
        const testCase = document.testCases[i];
        const numberLabel = testCase.number?.trim() || String(i + 1);

        children.push(
          new Paragraph({
            spacing: { before: 240, after: 100 },
            children: [
              run('Тест №', { bold: true, size: SIZE_H2, underline: {} }),
              run(numberLabel, { bold: true, size: SIZE_H2 }),
            ],
          }),
        );

        const goal = fromRichText(testCase.goal);
        if (goal.length > 0 || (testCase.title?.trim() && testCase.title.trim() !== numberLabel)) {
          children.push(labelParagraph('Цель:'));
          if (goal.length > 0) {
            children.push(...goal);
          } else {
            children.push(...bodyLines(testCase.title));
          }
        }

        if (settings.includeImages) {
          for (const attachment of testCase.goalImages.filter(isImageAttachment)) {
            children.push(...(await imageParagraphs(attachment.dataUrl)));
          }
        }

        if (testCase.preconditions?.trim()) {
          children.push(labelParagraph('Предварительные условия:'));
          children.push(...bodyLines(testCase.preconditions));
        }

        const steps = fromRichText(testCase.steps);
        if (steps.length > 0) {
          children.push(labelParagraph('Шаги:'));
          children.push(...steps);
        }

        const verification = inlineVerificationAttachments(
          testCase.verificationResult,
          testCase.verificationAttachments,
        );
        const verificationBlocks = await fromRichContent(verification, {
          includeImages: settings.includeImages,
          includeCodeBlocks: settings.includeCodeBlocks,
          includeLogs: settings.includeLogs,
        });
        const hasVerification =
          hasRichText(verification) ||
          (settings.includeImages &&
            Boolean(verification.html?.includes('data:image')));
        if (hasVerification) {
          children.push(labelParagraph('Результат проверки:'));
          children.push(...verificationBlocks);
        }

        if (testCase.testOutcome) {
          children.push(
            new Paragraph({
              spacing: { before: 80, after: 0 },
              children: [run('')],
            }),
          );
          children.push(
            new Paragraph({
              spacing: { before: 0, after: 160 },
              children: [
                run(`Результат тестирования: ${outcomeLabel(testCase)}.`, { bold: true }),
              ],
            }),
          );
        }
      }
    }
  }

  const doc = new Document({
    creator: 'Test Case Manager',
    title: taskName,
    description: taskName,
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: SIZE_BODY,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_TWIPS,
              height: PAGE_HEIGHT_TWIPS,
            },
            margin: { ...PAGE_MARGIN },
          },
        },
        footers: {
          default: new Footer({
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
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Merge a draft test case into the task document and export full PMI. */
export async function buildTestCaseDocx(context: {
  testCase: TestCase;
  taskName: string;
  settings: ExportSettings;
  document?: TaskDocument;
}): Promise<Uint8Array> {
  if (context.document) {
    const hasCase = context.document.testCases.some((item) => item.id === context.testCase.id);
    const merged: TaskDocument = {
      ...context.document,
      meta: {
        ...context.document.meta,
        name: context.document.meta.name || context.taskName,
      },
      testCases: hasCase
        ? context.document.testCases.map((item) =>
            item.id === context.testCase.id ? context.testCase : item,
          )
        : [...context.document.testCases, context.testCase],
    };
    return buildPmiDocx({ document: merged, settings: context.settings });
  }

  return buildPmiDocx({
    document: {
      formatVersion: 1,
      meta: {
        id: 'temp',
        name: context.taskName,
        shortName: '',
        description: '',
        author: '',
        testObject: '',
        testObjectLinks: [],
        application: '',
        testGoal: { html: '', plainText: '' },
        generalProvisions: '',
        functionalRequirements: { html: '', plainText: '' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      testCases: [context.testCase],
    },
    settings: context.settings,
  });
}
