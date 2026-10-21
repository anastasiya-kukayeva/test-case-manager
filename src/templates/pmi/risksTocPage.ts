import { inlineVerificationAttachments } from '@/application/testCases/testCaseFormMapper';
import type { ExportSettings, NamedLink, TaskDocument, TestCase } from '@/domain/types';
import { isImageAttachment } from '@/domain/types/attachment';
import {
  decodeDataUrlImage,
  htmlToExportBlocks,
  scaleImageToWidth,
  type RichExportBlock,
} from '@/infrastructure/export/exportUtils';
import {
  PAGE_CONTENT_HEIGHT_PX,
  PAGE_CONTENT_HEIGHT_TWIPS,
  PAGE_CONTENT_WIDTH_PX,
  PAGE_CONTENT_WIDTH_TWIPS,
  TWIPS_PER_PIXEL,
  hasRichText,
} from '@/templates/shared/docx';

/** Page 1 is the title, page 2 is the table of contents, the body starts on page 3. */
export const BODY_START_PAGE = 3;

/** Times New Roman 12 pt, single spacing. */
const BODY_LINE_TWIPS = 240;
const BODY_CHARS_PER_LINE = Math.max(1, Math.floor(PAGE_CONTENT_WIDTH_TWIPS / 120));
/** Heading 14 pt. */
const HEADING_LINE_TWIPS = 280;
const HEADING_CHARS_PER_LINE = Math.max(1, Math.floor(PAGE_CONTENT_WIDTH_TWIPS / 140));
/** Courier New 10 pt. */
const CODE_LINE_TWIPS = 200;
const CODE_CHARS_PER_LINE = Math.max(1, Math.floor(PAGE_CONTENT_WIDTH_TWIPS / 200));

type PageCursor = {
  pages: number;
  used: number;
};

function createCursor(): PageCursor {
  return { pages: 1, used: 0 };
}

function addHeight(cursor: PageCursor, height: number): void {
  let left = Math.max(0, height);
  while (left > 0) {
    const room = PAGE_CONTENT_HEIGHT_TWIPS - cursor.used;
    if (left < room) {
      cursor.used += left;
      return;
    }
    left -= room;
    cursor.pages += 1;
    cursor.used = 0;
  }
}

function addUnbreakable(cursor: PageCursor, height: number): void {
  const block = Math.min(Math.max(height, 0), PAGE_CONTENT_HEIGHT_TWIPS);
  if (block === 0) {
    return;
  }
  if (cursor.used > 0 && cursor.used + block > PAGE_CONTENT_HEIGHT_TWIPS) {
    cursor.pages += 1;
    cursor.used = 0;
  }
  addHeight(cursor, block);
}

function occupiedPages(cursor: PageCursor): number {
  if (cursor.used === 0) {
    return Math.max(1, cursor.pages - 1);
  }
  return cursor.pages;
}

function addParagraph(
  cursor: PageCursor,
  text: string,
  options?: { before?: number; after?: number; line?: number; charsPerLine?: number },
): void {
  addHeight(cursor, options?.before ?? 0);
  const charsPerLine = options?.charsPerLine ?? BODY_CHARS_PER_LINE;
  const lines = Math.max(1, Math.ceil(Math.max(text.length, 1) / charsPerLine));
  addHeight(cursor, lines * (options?.line ?? BODY_LINE_TWIPS));
  addHeight(cursor, options?.after ?? 0);
}

function addBodyLines(cursor: PageCursor, text: string): void {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line, index, all) => line.length > 0 || (index > 0 && all[index - 1].length > 0));
  for (const line of lines) {
    addParagraph(cursor, line.trimStart() || ' ', { after: 60 });
  }
}

function addPlainOrHtmlText(
  cursor: PageCursor,
  content: { html?: string; plainText?: string } | undefined,
): void {
  const html = content?.html?.trim();
  if (html) {
    const texts = htmlToExportBlocks(html).filter((block) => block.type === 'text');
    if (texts.length > 0) {
      for (const block of texts) {
        addParagraph(cursor, block.text, { after: 60 });
      }
      return;
    }
  }
  addBodyLines(cursor, content?.plainText || '');
}

async function addImage(cursor: PageCursor, dataUrl: string): Promise<void> {
  const decoded = await decodeDataUrlImage(dataUrl);
  if (!decoded) {
    addParagraph(cursor, 'изображение', { after: 60 });
    return;
  }
  const size = scaleImageToWidth(
    decoded.width,
    decoded.height,
    PAGE_CONTENT_WIDTH_PX,
    PAGE_CONTENT_HEIGHT_PX,
  );
  addUnbreakable(cursor, 100 + size.height * TWIPS_PER_PIXEL + 120);
}

async function addRichBlocks(
  cursor: PageCursor,
  blocks: RichExportBlock[],
  settings: ExportSettings,
): Promise<void> {
  for (const block of blocks) {
    if (block.type === 'text') {
      addParagraph(cursor, block.text, { after: 60 });
      continue;
    }
    if (block.type === 'image') {
      if (settings.includeImages) {
        await addImage(cursor, block.dataUrl);
      }
      continue;
    }
    if (block.type === 'code' && settings.includeCodeBlocks) {
      addParagraph(cursor, 'Код:', { before: 80, after: 40 });
      for (const line of (block.text || '—').split(/\r?\n/)) {
        addParagraph(cursor, line || ' ', {
          after: 20,
          line: CODE_LINE_TWIPS,
          charsPerLine: CODE_CHARS_PER_LINE,
        });
      }
      continue;
    }
    if (block.type === 'log' && settings.includeLogs) {
      addParagraph(cursor, 'Лог:', { before: 80, after: 40 });
      for (const line of (block.text || '—').split(/\r?\n/)) {
        addParagraph(cursor, line || ' ', {
          after: 20,
          line: CODE_LINE_TWIPS,
          charsPerLine: CODE_CHARS_PER_LINE,
        });
      }
    }
  }
}

async function addRichContent(
  cursor: PageCursor,
  content: { html?: string; plainText?: string } | undefined,
  settings: ExportSettings,
): Promise<void> {
  const html = content?.html?.trim() ?? '';
  if (html) {
    const blocks = htmlToExportBlocks(html);
    if (blocks.length > 0) {
      await addRichBlocks(cursor, blocks, settings);
      return;
    }
  }
  const plain = content?.plainText?.trim() ? content.plainText : '';
  if (plain) {
    addBodyLines(cursor, plain);
  }
}

function addHeading(cursor: PageCursor, text: string): void {
  addParagraph(cursor, text, {
    before: 280,
    after: 140,
    line: HEADING_LINE_TWIPS,
    charsPerLine: HEADING_CHARS_PER_LINE,
  });
}

function addLinks(cursor: PageCursor, links: NamedLink[] | undefined): void {
  for (const link of links ?? []) {
    const label = link.title.trim() || link.url.trim();
    if (!label) {
      continue;
    }
    addParagraph(cursor, label, { after: 60 });
  }
}

async function addTestCase(
  cursor: PageCursor,
  testCase: TestCase,
  index: number,
  settings: ExportSettings,
): Promise<void> {
  const numberLabel = testCase.number?.trim() || String(index + 1);
  addParagraph(cursor, `Тест №${numberLabel}`, {
    before: 240,
    after: 100,
    line: HEADING_LINE_TWIPS,
    charsPerLine: HEADING_CHARS_PER_LINE,
  });

  const goalText = testCase.goal?.plainText?.trim() || testCase.goal?.html?.trim();
  if (goalText || (testCase.title?.trim() && testCase.title.trim() !== numberLabel)) {
    addParagraph(cursor, 'Цель:', { before: 120, after: 60 });
    if (hasRichText(testCase.goal)) {
      addPlainOrHtmlText(cursor, testCase.goal);
    } else if (testCase.title?.trim()) {
      addBodyLines(cursor, testCase.title);
    }
  }

  if (settings.includeImages) {
    for (const attachment of testCase.goalImages.filter(isImageAttachment)) {
      await addImage(cursor, attachment.dataUrl);
    }
  }

  if (testCase.preconditions?.trim()) {
    addParagraph(cursor, 'Предварительные условия:', { before: 120, after: 60 });
    addBodyLines(cursor, testCase.preconditions);
  }

  const stepsHtml = testCase.steps?.html ?? '';
  const hasSteps =
    hasRichText(testCase.steps) || (settings.includeImages && stepsHtml.includes('data:image'));
  if (hasSteps) {
    addParagraph(cursor, 'Шаги:', { before: 120, after: 60 });
    await addRichContent(cursor, testCase.steps, settings);
  }

  const verification = inlineVerificationAttachments(
    testCase.verificationResult,
    testCase.verificationAttachments,
  );
  const hasVerification =
    hasRichText(verification) ||
    (settings.includeImages && Boolean(verification.html?.includes('data:image')));
  if (hasVerification) {
    addParagraph(cursor, 'Результат проверки:', { before: 120, after: 60 });
    await addRichContent(cursor, verification, settings);
  }

  if (testCase.testOutcome) {
    addParagraph(cursor, ' ', { before: 80, after: 0 });
    addParagraph(cursor, 'Результат тестирования', { after: 160 });
  }
}

/**
 * Page of «Риски и ограничения».
 * The section starts on the page after the body when the body is not empty.
 */
export async function estimateRisksTocPage(input: {
  sections: string[];
  meta: TaskDocument['meta'];
  testCases: TestCase[];
  settings: ExportSettings;
}): Promise<number> {
  if (input.sections.length === 0) {
    return BODY_START_PAGE;
  }

  const cursor = createCursor();
  for (const kind of input.sections) {
    if (kind === 'object') {
      addHeading(cursor, 'Объект испытаний');
      addBodyLines(cursor, input.meta.testObject);
      addLinks(cursor, input.meta.testObjectLinks);
      continue;
    }
    if (kind === 'goal') {
      addHeading(cursor, 'Цель испытаний');
      addPlainOrHtmlText(cursor, input.meta.testGoal);
      continue;
    }
    if (kind === 'general') {
      addHeading(cursor, 'Общие положения');
      addBodyLines(cursor, input.meta.generalProvisions);
      continue;
    }
    if (kind === 'functional') {
      addHeading(cursor, 'Требования к функциональности');
      addPlainOrHtmlText(cursor, input.meta.functionalRequirements);
      continue;
    }
    if (kind === 'scenario') {
      addHeading(cursor, 'Сценарий испытаний');
      for (let index = 0; index < input.testCases.length; index += 1) {
        await addTestCase(cursor, input.testCases[index], index, input.settings);
      }
    }
  }

  return BODY_START_PAGE + occupiedPages(cursor);
}
