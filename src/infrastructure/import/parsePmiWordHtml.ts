import { nanoid } from 'nanoid';
import type { ImageAttachment, RichTextContent, TestCase, TestResultOutcome } from '@/domain/types';

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
    pattern: /<strong>\s*Результат\s+теста\s*:?\s*<\/strong>/gi,
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
    next = next.replace(pattern, FIELD_MARKER[key]);
  }
  return next;
}

function sliceScenarioHtml(fullHtml: string): string {
  const matches = [...fullHtml.matchAll(/Сценарий\s+испытаний/gi)];
  if (matches.length === 0) {
    throw new Error('В документе не найден раздел «Сценарий испытаний»');
  }
  const last = matches[matches.length - 1];
  const start = last.index ?? 0;
  return fullHtml.slice(start);
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

/** Parse mammoth HTML of a PMI Word document into test-case drafts. */
export function parsePmiTestCasesFromHtml(fullHtml: string): ParsedPmiTestCase[] {
  const scenarioHtml = sliceScenarioHtml(fullHtml);
  const chunks = splitTestChunks(scenarioHtml);
  if (chunks.length === 0) {
    throw new Error('В разделе «Сценарий испытаний» не найдены блоки «Тест №…»');
  }
  return chunks.map((chunk) => parseTestBody(chunk.sourceNumber, chunk.bodyHtml));
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
    createdAt: now,
    updatedAt: now,
  };
}
