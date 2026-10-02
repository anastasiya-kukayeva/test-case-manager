import { nanoid } from 'nanoid';
import type {
  ImageAttachment,
  NamedLink,
  RichTextContent,
  TestCase,
  TestResultOutcome,
} from '@/domain/types';

const FIELD_MARKER = {
  goal: '[[[FIELD:goal]]]',
  preconditions: '[[[FIELD:preconditions]]]',
  steps: '[[[FIELD:steps]]]',
  verification: '[[[FIELD:verification]]]',
  outcome: '[[[FIELD:outcome]]]',
} as const;

type FieldKey = keyof typeof FIELD_MARKER;

export type ParsedPmiTestCase = {
  sourceNumber: string;
  title: string;
  goal: RichTextContent;
  goalImages: ImageAttachment[];
  preconditions: string;
  steps: RichTextContent;
  verificationResult: RichTextContent;
  testOutcome: TestResultOutcome;
};

const TEST_START_RE = /(?:<p[^>]*>\s*)?(?:<strong>)?\s*Тест\s*№\s*(\d+)\s*(?:<\/strong>)?\s*(?:<\/p>)?/gi;

const LABEL_REPLACERS: Array<{ key: FieldKey; pattern: RegExp }> = [
  { key: 'goal', pattern: /<strong>\s*Цель\s*:?\s*<\/strong>/gi },
  {
    key: 'preconditions',
    pattern: /<strong>\s*Предварительные\s+условия\s*:?\s*<\/strong>/gi,
  },
  { key: 'steps', pattern: /<strong>\s*Шаги\s*:?\s*<\/strong>/gi },
  {
    key: 'verification',
    pattern: /<strong>\s*Результат\s+проверки\s*:?\s*<\/strong>/gi,
  },
  {
    key: 'outcome',
    pattern: /<strong>\s*Результат\s+тест(?:а|ирования)\s*:?\s*([\s\S]*?)<\/strong>/gi,
  },
];

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/h\d>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanupHtml(html: string): string {
  return html
    .replace(/<\/?strong>/gi, (tag) => (tag.toLowerCase().startsWith('</') ? '</strong>' : '<strong>'))
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<strong>\s*<\/strong>/gi, '')
    .replace(/(?:<p>\s*)+$/g, '')
    .replace(/^(?:\s*<\/p>)+/g, '')
    .trim();
}

function htmlToRichText(html: string): RichTextContent {
  const cleaned = cleanupHtml(html);
  if (!cleaned) {
    return { html: '', plainText: '' };
  }
  return {
    html: cleaned,
    plainText: stripTags(cleaned),
  };
}

function extractImages(html: string): { htmlWithoutImages: string; images: ImageAttachment[] } {
  const images: ImageAttachment[] = [];
  const htmlWithoutImages = html.replace(
    /<img\b[^>]*src=["'](data:([^;'"]+);base64,[^"']+)["'][^>]*\/?>/gi,
    (_full, dataUrl: string, mimeType: string) => {
      const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
      images.push({
        id: nanoid(),
        kind: 'image',
        fileName: `import-${images.length + 1}.${ext}`,
        mimeType: mimeType || 'image/png',
        dataUrl,
        caption: '',
        createdAt: new Date().toISOString(),
      });
      return '';
    },
  );
  return { htmlWithoutImages, images };
}

function parseOutcome(html: string): TestResultOutcome {
  const text = stripTags(html).toLocaleLowerCase('ru');
  if (/не\s*успеш|провал|fail/.test(text)) {
    return 'failed';
  }
  if (/успеш|pass/.test(text)) {
    return 'passed';
  }
  return null;
}

function titleFromGoal(goal: RichTextContent, sourceNumber: string): string {
  const plain = goal.plainText.replace(/\s+/g, ' ').trim();
  if (!plain) {
    return `Тест №${sourceNumber}`;
  }
  return plain.length > 140 ? `${plain.slice(0, 137)}…` : plain;
}

function insertFieldMarkers(html: string): string {
  let next = html;
  for (const { key, pattern } of LABEL_REPLACERS) {
    if (key === 'outcome') {
      next = next.replace(pattern, (_full, value: string) => `${FIELD_MARKER.outcome}${value ?? ''}`);
      continue;
    }
    next = next.replace(pattern, FIELD_MARKER[key]);
  }
  return next;
}

function splitTestChunks(scenarioHtml: string): Array<{ sourceNumber: string; bodyHtml: string }> {
  const marked = insertFieldMarkers(scenarioHtml);
  const chunks: Array<{ sourceNumber: string; bodyHtml: string }> = [];
  const starts: Array<{ sourceNumber: string; index: number; endMarker: number }> = [];

  TEST_START_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TEST_START_RE.exec(marked))) {
    starts.push({
      sourceNumber: match[1],
      index: match.index,
      endMarker: match.index + match[0].length,
    });
  }

  for (let i = 0; i < starts.length; i++) {
    const current = starts[i];
    const next = starts[i + 1];
    const bodyHtml = marked.slice(current.endMarker, next ? next.index : undefined);
    chunks.push({ sourceNumber: current.sourceNumber, bodyHtml });
  }

  return chunks;
}

function takeField(body: string, key: FieldKey): { value: string; rest: string } {
  const marker = FIELD_MARKER[key];
  const start = body.indexOf(marker);
  if (start < 0) {
    return { value: '', rest: body };
  }

  const after = body.slice(start + marker.length);
  const nextPositions = (Object.values(FIELD_MARKER) as string[])
    .map((item) => after.indexOf(item))
    .filter((pos) => pos >= 0);
  const end = nextPositions.length > 0 ? Math.min(...nextPositions) : after.length;
  return {
    value: after.slice(0, end),
    rest: body.slice(0, start) + after.slice(end),
  };
}

function parseTestBody(sourceNumber: string, bodyHtml: string): ParsedPmiTestCase {
  let rest = bodyHtml;
  const goalPart = takeField(rest, 'goal');
  rest = goalPart.rest;
  const prePart = takeField(rest, 'preconditions');
  rest = prePart.rest;
  const stepsPart = takeField(rest, 'steps');
  rest = stepsPart.rest;
  const verificationPart = takeField(rest, 'verification');
  rest = verificationPart.rest;
  const outcomePart = takeField(rest, 'outcome');

  const goalExtracted = extractImages(goalPart.value);
  const verificationHtml = cleanupHtml(verificationPart.value);

  const goal = htmlToRichText(goalExtracted.htmlWithoutImages);
  const steps = htmlToRichText(stepsPart.value);
  const verificationResult = htmlToRichText(verificationHtml);
  const preconditions = stripTags(prePart.value);

  return {
    sourceNumber,
    title: titleFromGoal(goal, sourceNumber),
    goal,
    goalImages: goalExtracted.images,
    preconditions,
    steps,
    verificationResult,
    testOutcome: parseOutcome(outcomePart.value),
  };
}

export type ParsedPmiTaskFields = {
  name?: string;
  releaseNumber?: string;
  testObject?: string;
  testObjectLinks?: NamedLink[];
  testGoal?: RichTextContent;
  generalProvisions?: string;
  functionalRequirements?: RichTextContent;
  risksAndLimitations?: RichTextContent;
};

export type ParsedPmiDocument = {
  task: ParsedPmiTaskFields;
  testCases: ParsedPmiTestCase[];
};

const TASK_SECTIONS = [
  { key: 'object', title: 'Объект испытаний' },
  { key: 'goal', title: 'Цель испытаний' },
  { key: 'general', title: 'Общие положения' },
  { key: 'functional', title: 'Требования к функциональности' },
  { key: 'scenario', title: 'Сценарий испытаний' },
  { key: 'risks', title: 'Риски и ограничения' },
] as const;

type TaskSectionKey = (typeof TASK_SECTIONS)[number]['key'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function findLastHeading(html: string, title: string): { index: number; end: number } | null {
  const titlePattern = escapeRegExp(title);
  const patterns = [
    `<h[1-3][^>]*>\\s*(?:<[^>]+>\\s*)*${titlePattern}\\s*(?:</[^>]+>\\s*)*</h[1-3]>`,
    `<p[^>]*>\\s*<strong>\\s*${titlePattern}\\s*</strong>\\s*</p>`,
  ];
  let last: { index: number; end: number } | null = null;
  for (const source of patterns) {
    const re = new RegExp(source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      if (!last || match.index >= last.index) {
        last = { index: match.index, end: match.index + match[0].length };
      }
    }
  }
  return last;
}

function splitTaskSections(html: string): {
  sections: Map<TaskSectionKey, string>;
  firstIndex: number;
} {
  const found = TASK_SECTIONS.flatMap((section) => {
    const hit = findLastHeading(html, section.title);
    return hit ? [{ key: section.key, ...hit }] : [];
  }).sort((left, right) => left.index - right.index);

  const sections = new Map<TaskSectionKey, string>();
  for (let index = 0; index < found.length; index += 1) {
    const current = found[index];
    const next = found[index + 1];
    sections.set(current.key, html.slice(current.end, next ? next.index : html.length));
  }
  return { sections, firstIndex: found[0]?.index ?? -1 };
}

function pullPlainLinks(text: string): { text: string; links: NamedLink[] } {
  const kept: string[] = [];
  const links: NamedLink[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      kept.push('');
      continue;
    }
    const labeled =
      /^(.*?):\s+((?:https?:\/\/|mailto:|file:|\\\\|[A-Za-z]:\\).+)$/i.exec(line);
    if (labeled) {
      const url = labeled[2].trim();
      const title = labeled[1].trim();
      links.push({ id: nanoid(), title: title || url, url });
      continue;
    }
    const bare = /^((?:https?:\/\/|mailto:)\S+)$/i.exec(line);
    if (bare) {
      links.push({ id: nanoid(), title: bare[1], url: bare[1] });
      continue;
    }
    kept.push(rawLine);
  }
  return {
    text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    links,
  };
}

function extractNamedLinks(html: string): { html: string; links: NamedLink[] } {
  const links: NamedLink[] = [];
  const withoutAnchors = html.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_full, href: string, inner: string) => {
      const title = stripTags(inner);
      const url = decodeHtmlEntities(href).trim();
      if (!url) {
        return '';
      }
      links.push({
        id: nanoid(),
        title: title && title !== url ? title : url,
        url,
      });
      return '';
    },
  );
  return { html: withoutAnchors, links };
}

function nonemptyRich(html: string): RichTextContent | undefined {
  const value = htmlToRichText(html);
  if (!value.plainText && !value.html) {
    return undefined;
  }
  return value;
}

function parseTitleBlock(html: string, firstSectionIndex: number): Pick<
  ParsedPmiTaskFields,
  'name' | 'releaseNumber'
> {
  const head = firstSectionIndex >= 0 ? html.slice(0, firstSectionIndex) : html;
  const titleMatch = /Методика\s+испытаний\s+в\s+рамках\s+задачи:\s*([\s\S]*?)(?:<\/p>|<h[1-3]|$)/i.exec(
    head,
  );
  const result: Pick<ParsedPmiTaskFields, 'name' | 'releaseNumber'> = {};
  if (titleMatch) {
    const name = stripTags(titleMatch[1]).replace(/\s+/g, ' ').trim();
    if (name) {
      result.name = name.slice(0, 2000);
    }
    const afterTitle = head.slice((titleMatch.index ?? 0) + titleMatch[0].length);
    const paragraphs = [...afterTitle.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    for (const paragraph of paragraphs) {
      const line = stripTags(paragraph[1]).replace(/\s+/g, ' ').trim();
      if (!line || /^оглавление$/i.test(line) || /^\d+\.\s+/.test(line)) {
        if (/^оглавление$/i.test(line)) {
          break;
        }
        continue;
      }
      result.releaseNumber = line.slice(0, 80);
      break;
    }
  }
  return result;
}

function parseTaskFields(
  html: string,
  sections: Map<TaskSectionKey, string>,
  firstSectionIndex: number,
): ParsedPmiTaskFields {
  const task: ParsedPmiTaskFields = parseTitleBlock(html, firstSectionIndex);

  const objectHtml = sections.get('object');
  if (objectHtml) {
    const extracted = extractNamedLinks(objectHtml);
    const plain = pullPlainLinks(stripTags(extracted.html));
    if (plain.text) {
      task.testObject = plain.text;
    }
    const links = [...extracted.links, ...plain.links];
    if (links.length > 0) {
      task.testObjectLinks = links;
    }
  }

  const goal = sections.get('goal');
  if (goal) {
    const value = nonemptyRich(goal);
    if (value) {
      task.testGoal = value;
    }
  }

  const general = sections.get('general');
  if (general) {
    const text = stripTags(general);
    if (text) {
      task.generalProvisions = text;
    }
  }

  const functional = sections.get('functional');
  if (functional) {
    const value = nonemptyRich(functional);
    if (value) {
      task.functionalRequirements = value;
    }
  }

  const risks = sections.get('risks');
  if (risks) {
    const value = nonemptyRich(risks);
    if (value) {
      task.risksAndLimitations = value;
    }
  }

  return task;
}

function parseScenarioCases(scenarioHtml: string | undefined): ParsedPmiTestCase[] {
  if (!scenarioHtml) {
    return [];
  }
  const chunks = splitTestChunks(scenarioHtml);
  return chunks.map((chunk) => parseTestBody(chunk.sourceNumber, chunk.bodyHtml));
}

/** Parse mammoth HTML of a PMI Word document into task fields and test-case drafts. */
export function parsePmiDocumentFromHtml(fullHtml: string): ParsedPmiDocument {
  const { sections, firstIndex } = splitTaskSections(fullHtml);
  return {
    task: parseTaskFields(fullHtml, sections, firstIndex),
    testCases: parseScenarioCases(sections.get('scenario')),
  };
}

/** Parse mammoth HTML of a PMI Word document into test-case drafts. */
export function parsePmiTestCasesFromHtml(fullHtml: string): ParsedPmiTestCase[] {
  const cases = parsePmiDocumentFromHtml(fullHtml).testCases;
  if (cases.length === 0) {
    throw new Error('В разделе «Сценарий испытаний» не найдены блоки «Тест №…»');
  }
  return cases;
}

export function parsedPmiToTestCase(parsed: ParsedPmiTestCase, number: string): TestCase {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    number,
    title: parsed.title,
    section: '',
    module: '',
    author: '',
    developer: '',
    businessAnalyst: '',
    priority: 'medium',
    status:
      parsed.testOutcome === 'passed'
        ? 'passed'
        : parsed.testOutcome === 'failed'
          ? 'failed'
          : 'draft',
    goal: parsed.goal,
    goalImages: parsed.goalImages,
    preconditions: parsed.preconditions,
    steps: parsed.steps,
    verificationResult: parsed.verificationResult,
    verificationAttachments: [],
    testOutcome: parsed.testOutcome,
    includeInReport: true,
    includeInRegression: false,
    includeInTaskRegression: false,
    createdAt: now,
    updatedAt: now,
  };
}
