import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
} from 'docx';
import { htmlToExportBlocks, type ExportTextRun } from '@/infrastructure/export/exportUtils';

const FONT = 'Times New Roman';
const SIZE_TITLE = 32;
const SIZE_BODY = 24;

const MONTHS = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
] as const;

export const REGRESSION_REPORT_TITLE = 'Отчет по регрессионному тестированию';
export const REGRESSION_REPORT_TABLE_TITLE = 'Основные модули и статус проверки';
export const ROLLBACK_REPORT_TITLE = 'Отчёт по регрессионному тестированию отката доработок';
export const ROLLBACK_REPORT_TABLE_TITLE = 'Основные модули и статус проверки после отката:';
export const REGRESSION_REPORT_CONCLUSIONS_TITLE = 'Выводы и рекомендации';

export type RegressionReportKind = 'regression' | 'rollback';

const TABLE_HEADERS = ['№', 'Модуль / Подраздел', 'Статус', 'Кол-во багов', 'Комментарий'] as const;
/** Content width of the A4 page used below, in twips. */
const TABLE_WIDTHS = [700, 5422, 1200, 1400, 1200] as const;

export type RegressionReportCase = {
  /** Application name from the parent task. */
  applicationName: string;
  /** Module name from the parent task. Empty when the task has no module. */
  moduleName: string;
  /** Test case goal, regular text after the bold prefix. */
  text: string;
  /** Goal HTML. A link inside it is exported as a hyperlink with its name. */
  html?: string;
};

export type RegressionReportHeader = {
  /** Module the report is exported from. Empty when the task has no module. */
  moduleName: string;
  /** Short task name used in the suggested file name. Several names are joined when the report covers more than one task. */
  taskShortName: string;
  conductedAt?: Date;
  /** Default author from the directory. */
  authorName: string;
  /** Default environment from the directory. */
  environmentName: string;
  /** Regression keeps the current header. Rollback uses the rollback sample header. */
  kind?: RegressionReportKind;
  /** Cases marked for this report. */
  cases: RegressionReportCase[];
};

function run(
  text: string,
  options: { bold?: boolean; size?: number; color?: string; underline?: object } = {},
) {
  return new TextRun({
    font: FONT,
    size: options.size ?? SIZE_BODY,
    bold: options.bold,
    color: options.color,
    underline: options.underline,
    text,
  });
}

function formatConductedAt(date: Date): string {
  const month = MONTHS[date.getMonth()] ?? '';
  return `${month} ${date.getFullYear()}`;
}

function reportKind(header: Pick<RegressionReportHeader, 'kind'>): RegressionReportKind {
  return header.kind === 'rollback' ? 'rollback' : 'regression';
}

/** Suggested file name. A colon is not allowed in a Windows file name, so the title uses a dash. */
export function regressionReportFileName(
  taskShortName: string,
  conductedAt = new Date(),
  kind: RegressionReportKind = 'regression',
): string {
  const task = taskShortName.trim() || 'Без названия';
  const prefix =
    kind === 'rollback'
      ? 'Отчёт по регрессионному тестированию отката доработок'
      : 'Регрессионный отчет';
  return `${prefix} - ${task} за ${formatConductedAt(conductedAt)}`;
}

function projectLine(moduleName: string): string {
  const moduleLabel = moduleName.trim();
  if (!moduleLabel) {
    return 'Проект: BPM-система';
  }
  return `Проект: BPM-система (${moduleLabel})`;
}

function responsibleLine(authorName: string): string {
  const name = authorName.trim();
  return name
    ? `Ответственный: Специалист по тестированию ПО: ${name}`
    : 'Ответственный: Специалист по тестированию ПО:';
}

function isWebUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Header lines of the regression or rollback report, in the order of the sample file. */
export function regressionReportHeaderLines(header: RegressionReportHeader): string[] {
  const conductedAt = header.conductedAt ?? new Date();
  const rollback = reportKind(header) === 'rollback';
  return [
    rollback ? ROLLBACK_REPORT_TITLE : REGRESSION_REPORT_TITLE,
    projectLine(header.moduleName),
    `Дата проведения: ${formatConductedAt(conductedAt)}`,
    rollback ? 'Тип тестирования: Тестирование отката' : 'Тип тестирования: Регрессионное',
    'Форма: Ручное',
    responsibleLine(header.authorName),
    header.environmentName.trim() ? `Среда: ${header.environmentName.trim()}` : 'Среда:',
  ];
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [run(text)],
  });
}

function cellParagraph(
  children: Array<TextRun | ExternalHyperlink>,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
): Paragraph {
  return new Paragraph({
    alignment: align,
    spacing: { after: 0 },
    children,
  });
}

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [cellParagraph([run(text, { bold: true })], AlignmentType.CENTER)],
  });
}

function textCell(
  text: string,
  width: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  options: { bold?: boolean; color?: string } = {},
): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [cellParagraph([run(text, options)], align)],
  });
}

function runsToChildren(runs: ExportTextRun[]): Array<TextRun | ExternalHyperlink> {
  return runs.map((piece) => {
    const textRun = run(piece.text || ' ', {
      bold: piece.bold,
      color: piece.link ? (piece.color ?? '0563C1') : piece.color,
      underline: piece.link || piece.underline ? {} : undefined,
    });
    if (!piece.link) {
      return textRun;
    }
    return new ExternalHyperlink({
      link: piece.link,
      children: [textRun],
    });
  });
}

function caseDescriptionCell(item: RegressionReportCase, width: number): TableCell {
  const labels = [item.applicationName.trim(), item.moduleName.trim()].filter(Boolean);
  const prefix = labels.length > 0 ? [run(`${labels.join('. ')}. `, { bold: true })] : [];
  const blocks = (item.html ? htmlToExportBlocks(item.html) : []).filter(
    (block) => block.type === 'text',
  );
  const paragraphs =
    blocks.length > 0
      ? blocks.map((block, index) =>
          cellParagraph([...(index === 0 ? prefix : []), ...runsToChildren(block.runs)]),
        )
      : [cellParagraph([...prefix, run(item.text.trim())])];
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: paragraphs,
  });
}

const BUG_SUMMARY_LINES = [
  'Общее количество багов: 0',
  ' - Blocker: 0',
  ' - Major: 0',
  ' - Minor: 0',
  ' - Trivial/UI: 0',
] as const;

function bugSummaryParagraphs(): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 200 }, children: [] }),
    ...BUG_SUMMARY_LINES.map(
      (text) =>
        new Paragraph({
          spacing: { after: 0, line: 240 },
          children: [run(text)],
        }),
    ),
  ];
}

function reportTable(cases: RegressionReportCase[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: TABLE_HEADERS.map((label, index) => headerCell(label, TABLE_WIDTHS[index] ?? 1000)),
  });
  const rows = cases.map((item, index) => {
    const widths = TABLE_WIDTHS;
    return new TableRow({
      children: [
        textCell(String(index + 1), widths[0], AlignmentType.CENTER),
        caseDescriptionCell(item, widths[1]),
        textCell('PASS', widths[2], AlignmentType.CENTER, { bold: true, color: '008000' }),
        textCell('0', widths[3], AlignmentType.CENTER),
        textCell('', widths[4]),
      ],
    });
  });
  return new Table({
    width: { size: TABLE_WIDTHS.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
    columnWidths: [...TABLE_WIDTHS],
    rows: [header, ...rows],
  });
}

function environmentParagraph(environmentName: string): Paragraph {
  const name = environmentName.trim();
  if (!name) {
    return bodyParagraph('Среда:');
  }
  if (!isWebUrl(name)) {
    return bodyParagraph(`Среда: ${name}`);
  }
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      run('Среда: '),
      new ExternalHyperlink({
        link: name,
        children: [run(name, { color: '0563C1', underline: {} })],
      }),
    ],
  });
}

export async function buildRegressionReportDocx(
  header: RegressionReportHeader,
): Promise<Uint8Array> {
  const lines = regressionReportHeaderLines(header);
  const title = lines[0] ?? REGRESSION_REPORT_TITLE;
  const tableTitle =
    reportKind(header) === 'rollback' ? ROLLBACK_REPORT_TABLE_TITLE : REGRESSION_REPORT_TABLE_TITLE;
  const children: FileChild[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [run(title, { bold: true, size: SIZE_TITLE })],
    }),
    bodyParagraph(lines[1] ?? ''),
    bodyParagraph(lines[2] ?? ''),
    bodyParagraph(lines[3] ?? ''),
    bodyParagraph(lines[4] ?? ''),
    bodyParagraph(lines[5] ?? ''),
    environmentParagraph(header.environmentName),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160 },
      children: [run(tableTitle, { bold: true, size: SIZE_TITLE })],
    }),
    reportTable(header.cases),
    ...bugSummaryParagraphs(),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160 },
      children: [run(REGRESSION_REPORT_CONCLUSIONS_TITLE, { bold: true, size: SIZE_TITLE })],
    }),
  ];

  const doc = new Document({
    creator: 'Test Case Manager',
    title,
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
            size: { width: 11906, height: 16838 },
            margin: { top: 850, bottom: 1134, left: 1134, right: 850 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
