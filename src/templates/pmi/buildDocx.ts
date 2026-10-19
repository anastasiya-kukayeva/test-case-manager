import {
  AlignmentType,
  Bookmark,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  InternalHyperlink,
  LeaderType,
  Packer,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
  type FileChild,
} from 'docx';
import { inlineVerificationAttachments } from '@/application/testCases/testCaseFormMapper';
import type { ExportSettings, NamedLink, TaskDocument, TestCase } from '@/domain/types';
import { isImageAttachment } from '@/domain/types/attachment';
import {
  FONT,
  PAGE_HEIGHT_TWIPS,
  PAGE_MARGIN,
  PAGE_WIDTH_TWIPS,
  SIZE_BODY,
  SIZE_H2,
  SIZE_TITLE,
  SIZE_TOC,
  SIZE_TOC_TITLE,
  bodyLines,
  fromRichContent,
  fromRichText,
  hasRichText,
  imageParagraphs,
  pageBreak,
  pageNumberFooter,
  run,
} from '@/templates/shared/docx';

export type PmiDocxExportContext = {
  document: TaskDocument;
  settings: ExportSettings;
};
type TocEntry = {
  id: string;
  title: string;
  /** Absolute page number written into the file as text. */
  page: number;
};

/** Page 1 = title, page 2 = TOC, body starts at page 3 (sections flow continuously). */
const BODY_START_PAGE = 3;

function estimateRisksTocPage(testCaseCount: number, hasPrecedingBody: boolean): number {
  if (!hasPrecedingBody) {
    return BODY_START_PAGE;
  }
  const bodyPages = Math.max(1, testCaseCount);
  return BODY_START_PAGE + bodyPages;
}
function titleParagraph(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    // Push title toward vertical middle of the first page
    spacing: { before: 4200, after: 300 },
    children: [run(text, { bold: true, size: SIZE_TITLE })],
  });
}

function titlePageBlocks(taskName: string, releaseNumber: string): FileChild[] {
  const title = `Методика испытаний в рамках задачи: ${taskName}`;
  const blocks: FileChild[] = [titleParagraph(title)];
  const release = releaseNumber.trim();
  if (!release) {
    return blocks;
  }

  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
      children: [run('')],
    }),
  );
  blocks.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [run(release, { bold: true, size: SIZE_TITLE })],
    }),
  );
  return blocks;
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
function outcomeLabel(testCase: TestCase): string {
  if (testCase.testOutcome === 'passed') {
    return 'успешно';
  }
  if (testCase.testOutcome === 'failed') {
    return 'неуспешно';
  }
  return 'не выбран';
}
/**
 * PMI-style Word export matching the methodology sample:
 * title → filled task sections → scenario with test cases.
 */
export async function buildPmiDocx(context: PmiDocxExportContext): Promise<Uint8Array> {
  const { document, settings } = context;
  const meta = document.meta;
  const testCases = document.testCases.filter((item) => !item.regressionOnly);
  const children: FileChild[] = [];

  const taskName = meta.name?.trim() || 'Без названия';
  children.push(...titlePageBlocks(taskName, meta.releaseNumber ?? ''));
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
  if (testCases.length > 0) {
    sectionPlan.push({ id: 'toc-scenario', title: 'Сценарий испытаний', kind: 'scenario' });
  }

  const hasRisks = hasRichText(meta.risksAndLimitations);

  // Body flows on one continuous sequence starting at page 3.
  const tocEntries: TocEntry[] = sectionPlan.map((section) => ({
    id: section.id,
    title: section.title,
    page: BODY_START_PAGE,
  }));
  if (hasRisks) {
    tocEntries.push({
      id: 'toc-risks',
      title: 'Риски и ограничения',
      page: estimateRisksTocPage(testCases.length, sectionPlan.length > 0),
    });
  }

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
      for (let i = 0; i < testCases.length; i += 1) {
        const testCase = testCases[i];
        const numberLabel = testCase.number?.trim() || String(i + 1);

        children.push(
          new Paragraph({
            spacing: { before: 240, after: 100 },
            children: [
              run('Тест №', { bold: true, size: SIZE_H2, underline: {} }),
              run(numberLabel, { bold: true, size: SIZE_H2, underline: {} }),
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

        const stepsHtml = testCase.steps?.html ?? '';
        const hasSteps =
          hasRichText(testCase.steps) ||
          (settings.includeImages && stepsHtml.includes('data:image'));
        if (hasSteps) {
          children.push(labelParagraph('Шаги:'));
          children.push(
            ...(await fromRichContent(testCase.steps, {
              includeImages: settings.includeImages,
              includeCodeBlocks: settings.includeCodeBlocks,
              includeLogs: settings.includeLogs,
            })),
          );
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

  if (hasRisks) {
    if (sectionPlan.length > 0) {
      children.push(pageBreak());
    }
    children.push(sectionHeading('Риски и ограничения', 'toc-risks'));
    children.push(...fromRichText(meta.risksAndLimitations));
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
          default: pageNumberFooter(),
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
        releaseNumber: '',
        description: '',
        author: '',
        testObject: '',
        testObjectLinks: [],
        application: '',
        module: '',
        testGoal: { html: '', plainText: '' },
        generalProvisions: '',
        functionalRequirements: { html: '', plainText: '' },
        risksAndLimitations: { html: '', plainText: '' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      testCases: [context.testCase],
    },
    settings: context.settings,
  });
}

