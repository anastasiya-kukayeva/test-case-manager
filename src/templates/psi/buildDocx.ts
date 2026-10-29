import {
  AlignmentType,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  VerticalAlign,
  WidthType,
  type FileChild,
} from 'docx';
import type {
  ExportSettings,
  PsiResultItem,
  PsiStep,
  RichTextContent,
  TaskDocument,
  TestCase,
} from '@/domain/types';
import {
  FONT,
  PAGE_HEIGHT_TWIPS,
  PAGE_MARGIN,
  PAGE_WIDTH_TWIPS,
  SIZE_BODY,
  SIZE_H2,
  SIZE_TITLE,
  fromRichContent,
  pageBreak,
  pageOfFooter,
  run,
} from '@/templates/shared/docx';
import { compareModuleNames } from '@/domain/utils/moduleOrder';
import { isRichContentFilled } from '@/templates/shared/richContent';

const PSI_DOCUMENT_TITLE = 'Программа и методика приемо-сдаточных испытаний';
/** 1.5 cm. Word twips: 1 in = 1440, 1 in = 2.54 cm. */
const MARGIN_SIDE_TWIPS = Math.round((1.5 * 1440) / 2.54);
/** ImageRun sizes are CSS pixels at 96 DPI (1 px = 15 twips). */
const TWIPS_PER_PIXEL = 15;
/** Gap between the cell border and the text or screenshot, each side. */
const CELL_PAD_X = 60;

const PSI_TABLE_MARGIN = {
  top: PAGE_MARGIN.top,
  bottom: PAGE_MARGIN.bottom,
  left: MARGIN_SIDE_TWIPS,
  right: MARGIN_SIDE_TWIPS,
} as const;

/** A4 landscape content width: long side minus 1.5 cm on each side. */
const LANDSCAPE_CONTENT_WIDTH_TWIPS =
  PAGE_HEIGHT_TWIPS - PSI_TABLE_MARGIN.left - PSI_TABLE_MARGIN.right;
const LANDSCAPE_CONTENT_HEIGHT_PX = Math.max(
  1,
  Math.floor((PAGE_WIDTH_TWIPS - PSI_TABLE_MARGIN.top - PSI_TABLE_MARGIN.bottom) / TWIPS_PER_PIXEL),
);

/**
 * Times New Roman 12 pt bold, plus cell padding.
 * № fits two digits and not three.
 * «Наименование» stays on the first line, «теста» wraps.
 * «Описание теста /» and «воспроизведения» each fit on their own line.
 * The two result columns share the remaining width equally.
 */
const COLUMN_NUMBER = 520;
const COLUMN_NAME = 2420;
const COLUMN_STEPS = 2820;
const COLUMN_RESULTS_WIDTH =
  LANDSCAPE_CONTENT_WIDTH_TWIPS - COLUMN_NUMBER - COLUMN_NAME - COLUMN_STEPS;
const COLUMN_RESULT = Math.floor(COLUMN_RESULTS_WIDTH / 2);
const COLUMN_WIDTHS = [
  COLUMN_NUMBER,
  COLUMN_NAME,
  COLUMN_STEPS,
  COLUMN_RESULT,
  COLUMN_RESULTS_WIDTH - COLUMN_RESULT,
] as const;

function releaseLine(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (/^релиз\b/i.test(trimmed)) {
    return trimmed;
  }
  return `Релиз ${trimmed}`;
}

function cell(children: FileChild[], width: number): TableCell {
  const content = children.length > 0 ? children : [new Paragraph({ children: [run('')] })];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: CELL_PAD_X, right: CELL_PAD_X },
    children: content,
  });
}

function headerCell(lines: string[], width: number): TableCell {
  return cell(
    [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: lines.map((line, index) =>
          run(line, index === 0 ? { bold: true } : { bold: true, break: 1 }),
        ),
      }),
    ],
    width,
  );
}

function columnImageWidthPx(columnTwips: number): number {
  return Math.max(1, Math.floor((columnTwips - CELL_PAD_X * 2) / TWIPS_PER_PIXEL));
}

async function numberedRich(
  items: RichTextContent[],
  settings: ExportSettings,
  imageMaxWidthPx: number,
): Promise<FileChild[]> {
  const blocks: FileChild[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const content = await fromRichContent(items[index], {
      includeImages: settings.includeImages,
      includeCodeBlocks: settings.includeCodeBlocks,
      includeLogs: settings.includeLogs,
      emptyText: '',
      imageMaxWidthPx,
      imageMaxHeightPx: LANDSCAPE_CONTENT_HEIGHT_PX,
      leadIn: `${index + 1}.`,
      spacingBefore: index === 0 ? 0 : 120,
    });
    blocks.push(...content);
  }
  return blocks;
}

function savedResults(items: PsiResultItem[] | undefined): PsiResultItem[] {
  return (items ?? []).filter(
    (item) => isRichContentFilled(item.expected) || isRichContentFilled(item.actual),
  );
}

function exportCases(document: TaskDocument): TestCase[] {
  return document.testCases.filter((item) => !item.regressionOnly);
}

async function testCaseRow(
  testCase: TestCase,
  fallbackNumber: string,
  settings: ExportSettings,
): Promise<TableRow> {
  const steps = (testCase.psiSteps ?? []).map((step: PsiStep) => step.content);
  const results = savedResults(testCase.psiResults);
  const stepImageWidth = columnImageWidthPx(COLUMN_WIDTHS[2]);
  const resultImageWidth = columnImageWidthPx(COLUMN_WIDTHS[3]);
  return new TableRow({
    children: [
      cell(
        [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [run(testCase.number?.trim() || fallbackNumber)],
          }),
        ],
        COLUMN_WIDTHS[0],
      ),
      cell(
        [
          new Paragraph({
            children: [run(testCase.title?.trim() || '')],
          }),
        ],
        COLUMN_WIDTHS[1],
      ),
      cell(await numberedRich(steps, settings, stepImageWidth), COLUMN_WIDTHS[2]),
      cell(
        await numberedRich(
          results.map((item) => item.expected),
          settings,
          resultImageWidth,
        ),
        COLUMN_WIDTHS[3],
      ),
      cell(
        await numberedRich(
          results.map((item) => item.actual),
          settings,
          resultImageWidth,
        ),
        COLUMN_WIDTHS[4],
      ),
    ],
  });
}

function moduleHeadingRow(label: string): TableRow {
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        columnSpan: COLUMN_WIDTHS.length,
        width: { size: LANDSCAPE_CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: 'E7EEF7' },
        margins: { top: 80, bottom: 80, left: CELL_PAD_X, right: CELL_PAD_X },
        children: [
          new Paragraph({
            children: [run(label, { bold: true })],
          }),
        ],
      }),
    ],
  });
}

function tableHeaderRow(): TableRow {
  return new TableRow({
    tableHeader: false,
    children: [
      headerCell(['№'], COLUMN_WIDTHS[0]),
      headerCell(['Наименование', 'теста'], COLUMN_WIDTHS[1]),
      headerCell(['Описание теста /', 'шаги', 'воспроизведения'], COLUMN_WIDTHS[2]),
      headerCell(['Ожидаемый результат'], COLUMN_WIDTHS[3]),
      headerCell(['Фактический результат'], COLUMN_WIDTHS[4]),
    ],
  });
}

export async function buildPsiDocx(context: {
  document: TaskDocument;
  settings: ExportSettings;
}): Promise<Uint8Array> {
  const { document, settings } = context;
  const meta = document.meta;
  const taskName = meta.name?.trim() || 'Без названия';
  const titleChildren: FileChild[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2800, after: 240 },
      children: [run(PSI_DOCUMENT_TITLE, { bold: true, size: SIZE_TITLE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [run(taskName, { bold: true, size: SIZE_H2 })],
    }),
  ];

  const release = releaseLine(meta.releaseNumber ?? '');
  if (release) {
    titleChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 120, after: 200 },
        children: [run(release, { bold: true, size: SIZE_TITLE })],
      }),
    );
  }

  const bodyChildren: FileChild[] = [
    new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        run('Тестовые сценарии и результаты их выполнения', { bold: true, size: SIZE_H2 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [run('Тестовые сценарии и результаты их проверок приведены в таблице:')],
    }),
  ];

  const testCases = exportCases(document);
  const rows: TableRow[] = [tableHeaderRow()];

  for (let index = 0; index < testCases.length; index += 1) {
    rows.push(await testCaseRow(testCases[index], String(index + 1), settings));
  }

  bodyChildren.push(
    new Table({
      width: { size: LANDSCAPE_CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      columnWidths: [...COLUMN_WIDTHS],
      layout: TableLayoutType.FIXED,
      rows,
    }),
  );

  const doc = new Document({
    creator: 'Test Case Manager',
    title: taskName,
    description: PSI_DOCUMENT_TITLE,
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
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { ...PAGE_MARGIN },
          },
        },
        footers: { default: pageOfFooter() },
        children: titleChildren,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: {
              width: PAGE_WIDTH_TWIPS,
              height: PAGE_HEIGHT_TWIPS,
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { ...PSI_TABLE_MARGIN },
          },
        },
        footers: { default: pageOfFooter() },
        children: bodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}

export type PsiCombinedModule = {
  moduleName: string;
  documents: TaskDocument[];
};

/** Landscape tables, one module per sheet: the module name, then that module's cases. */
export async function buildPsiCombinedDocx(context: {
  groups: PsiCombinedModule[];
  settings: ExportSettings;
}): Promise<Uint8Array> {
  const { groups, settings } = context;
  const bodyChildren: FileChild[] = [
    new Paragraph({
      spacing: { before: 200, after: 120 },
      children: [
        run('Тестовые сценарии и результаты их выполнения', { bold: true, size: SIZE_H2 }),
      ],
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [run('Тестовые сценарии и результаты их проверок приведены в таблице:')],
    }),
  ];

  const orderedGroups = [...groups]
    .filter((group) => group.documents.length > 0)
    .sort((left, right) => compareModuleNames(left.moduleName, right.moduleName));
  for (let groupIndex = 0; groupIndex < orderedGroups.length; groupIndex += 1) {
    const group = orderedGroups[groupIndex];
    if (groupIndex > 0) {
      bodyChildren.push(pageBreak());
    }
    const rows: TableRow[] = [tableHeaderRow(), moduleHeadingRow(group.moduleName)];
    for (const document of group.documents) {
      const testCases = exportCases(document);
      for (let index = 0; index < testCases.length; index += 1) {
        rows.push(await testCaseRow(testCases[index], String(index + 1), settings));
      }
    }
    bodyChildren.push(
      new Table({
        width: { size: LANDSCAPE_CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
        columnWidths: [...COLUMN_WIDTHS],
        layout: TableLayoutType.FIXED,
        rows,
      }),
    );
  }

  const doc = new Document({
    creator: 'Test Case Manager',
    title: PSI_DOCUMENT_TITLE,
    description: PSI_DOCUMENT_TITLE,
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
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: { ...PSI_TABLE_MARGIN },
          },
        },
        footers: { default: pageOfFooter() },
        children: bodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
