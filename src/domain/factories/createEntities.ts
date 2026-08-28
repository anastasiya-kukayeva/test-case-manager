import { nanoid } from 'nanoid';
import {
  TC_PROJECT_FORMAT_VERSION,
  type ProjectDocument,
  type ProjectMeta,
  type RichTextContent,
  type TestCase,
} from '@/domain/types';

export function createEmptyRichText(plainText = ''): RichTextContent {
  return {
    html: plainText ? `<p>${plainText}</p>` : '',
    plainText,
  };
}

/** Convert legacy structured steps (or string) into rich text. */
export function normalizeStepsContent(value: unknown): RichTextContent {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.html === 'string' || typeof record.plainText === 'string') {
      const html = typeof record.html === 'string' ? record.html : '';
      const plainText =
        typeof record.plainText === 'string'
          ? record.plainText
          : html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return { html, plainText };
    }
  }

  if (typeof value === 'string') {
    return createEmptyRichText(value);
  }

  if (Array.isArray(value)) {
    const items = value
      .map((raw) => {
        if (!raw || typeof raw !== 'object') {
          return '';
        }
        const step = raw as Record<string, unknown>;
        const action = typeof step.action === 'string' ? step.action.trim() : '';
        const expected =
          typeof step.expectedResult === 'string' ? step.expectedResult.trim() : '';
        const actual =
          typeof step.actualResult === 'string' ? step.actualResult.trim() : '';
        const comment = typeof step.comment === 'string' ? step.comment.trim() : '';
        const parts = [action];
        if (expected) {
          parts.push(`Ожидаемый результат: ${expected}`);
        }
        if (actual) {
          parts.push(`Фактический результат: ${actual}`);
        }
        if (comment) {
          parts.push(`Комментарий: ${comment}`);
        }
        return parts.filter(Boolean).join('\n');
      })
      .filter(Boolean);

    if (items.length === 0) {
      return createEmptyRichText();
    }

    const escapeHtml = (text: string) =>
      text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    return {
      html: `<ol>${items.map((item) => `<li><p>${escapeHtml(item)}</p></li>`).join('')}</ol>`,
      plainText: items.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    };
  }

  return createEmptyRichText();
}

export function createEmptyTestCase(partial?: Partial<TestCase>): TestCase {
  const now = new Date().toISOString();

  return {
    id: partial?.id ?? nanoid(),
    number: partial?.number ?? `TC-${Date.now().toString().slice(-6)}`,
    title: partial?.title ?? '',
    section: partial?.section ?? '',
    module: partial?.module ?? '',
    author: partial?.author ?? '',
    developer: partial?.developer ?? '',
    businessAnalyst: partial?.businessAnalyst ?? '',
    priority: partial?.priority ?? 'medium',
    status: partial?.status ?? 'draft',
    goal: partial?.goal ?? createEmptyRichText(),
    goalImages: partial?.goalImages ?? [],
    preconditions: partial?.preconditions ?? '',
    steps: partial?.steps ?? createEmptyRichText(),
    verificationResult: partial?.verificationResult ?? createEmptyRichText(),
    verificationAttachments: partial?.verificationAttachments ?? [],
    testOutcome: partial?.testOutcome ?? null,
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

export function createTaskMeta(partial?: Partial<ProjectMeta>): ProjectMeta {
  const now = new Date().toISOString();

  return {
    id: partial?.id ?? nanoid(),
    name: partial?.name ?? 'Новая задача',
    shortName: partial?.shortName ?? '',
    description: partial?.description ?? '',
    author: partial?.author ?? '',
    testObject: partial?.testObject ?? '',
    testObjectLinks: partial?.testObjectLinks ?? [],
    application: partial?.application ?? '',
    testGoal: partial?.testGoal ?? createEmptyRichText(),
    generalProvisions: partial?.generalProvisions ?? '',
    functionalRequirements: partial?.functionalRequirements ?? createEmptyRichText(),
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

/** @deprecated use createTaskMeta */
export const createProjectMeta = createTaskMeta;

export function createEmptyTaskDocument(partial?: {
  meta?: Partial<ProjectMeta>;
  testCases?: TestCase[];
}): ProjectDocument {
  return {
    formatVersion: TC_PROJECT_FORMAT_VERSION,
    meta: createTaskMeta(partial?.meta),
    testCases: partial?.testCases ?? [],
  };
}

/** @deprecated use createEmptyTaskDocument */
export const createEmptyProjectDocument = createEmptyTaskDocument;
