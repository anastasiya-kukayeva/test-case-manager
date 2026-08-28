import { AppError } from '@/application/errors/AppError';
import { normalizeStepsContent } from '@/domain/factories/createEntities';
import {
  TC_TASK_FILE_EXTENSION,
  TC_TASK_FILE_EXTENSION_LEGACY,
  TC_TASK_FORMAT_VERSION,
  TC_TASK_MIME,
  type NamedLink,
  type RichTextContent,
  type TaskDocument,
} from '@/domain/types';
import { nanoid } from 'nanoid';

export type TcTaskFileEnvelope = {
  magic: 'TCM_TASK' | 'TCM_PROJECT';
  mime: string;
  formatVersion: number;
  savedAt: string;
  document: TaskDocument;
};

export function ensureTaskExtension(filePath: string): string {
  const normalized = filePath.replace(/[/\\]+$/, '');
  const lower = normalized.toLowerCase();
  if (
    lower.endsWith(`.${TC_TASK_FILE_EXTENSION}`) ||
    lower.endsWith(`.${TC_TASK_FILE_EXTENSION_LEGACY}`)
  ) {
    return normalized;
  }
  return `${normalized}.${TC_TASK_FILE_EXTENSION}`;
}

/** @deprecated use ensureTaskExtension */
export const ensureTcprojExtension = ensureTaskExtension;

export function serializeTaskDocument(document: TaskDocument): string {
  const envelope: TcTaskFileEnvelope = {
    magic: 'TCM_TASK',
    mime: TC_TASK_MIME,
    formatVersion: TC_TASK_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
    document: {
      ...document,
      formatVersion: TC_TASK_FORMAT_VERSION,
      meta: {
        ...document.meta,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}

/** @deprecated use serializeTaskDocument */
export const serializeProjectDocument = serializeTaskDocument;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseTaskFileContent(content: string): TaskDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AppError('PROJECT_INVALID', 'Файл задачи повреждён или имеет неверный JSON', {
      cause: error,
    });
  }

  if (
    isRecord(parsed) &&
    (parsed.magic === 'TCM_TASK' || parsed.magic === 'TCM_PROJECT') &&
    isRecord(parsed.document)
  ) {
    return validateTaskDocument(parsed.document);
  }

  if (isRecord(parsed) && isRecord(parsed.meta) && Array.isArray(parsed.testCases)) {
    return validateTaskDocument(parsed);
  }

  throw new AppError(
    'PROJECT_INVALID',
    `Файл не является задачей Test Case Manager (*.${TC_TASK_FILE_EXTENSION} / *.${TC_TASK_FILE_EXTENSION_LEGACY})`,
  );
}

/** @deprecated use parseTaskFileContent */
export const parseProjectFileContent = parseTaskFileContent;

function parseRichText(value: unknown): RichTextContent {
  if (isRecord(value)) {
    const html = typeof value.html === 'string' ? value.html : '';
    const plainText =
      typeof value.plainText === 'string'
        ? value.plainText
        : html
          ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : '';
    return { html, plainText };
  }

  if (typeof value === 'string' && value.trim()) {
    return {
      html: `<p>${value}</p>`,
      plainText: value,
    };
  }

  return { html: '', plainText: '' };
}

function parseNamedLinks(value: unknown): NamedLink[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : nanoid(),
      title: typeof item.title === 'string' ? item.title : '',
      url: typeof item.url === 'string' ? item.url : '',
    }))
    .filter((item) => item.url.trim().length > 0 || item.title.trim().length > 0);
}

export function validateTaskDocument(value: unknown): TaskDocument {
  if (!isRecord(value)) {
    throw new AppError('PROJECT_INVALID', 'Некорректная структура документа задачи');
  }

  if (!isRecord(value.meta)) {
    throw new AppError('PROJECT_INVALID', 'В задаче отсутствует блок meta');
  }

  const meta = value.meta;
  const requiredMetaFields = ['id', 'name', 'createdAt', 'updatedAt'] as const;

  for (const field of requiredMetaFields) {
    if (typeof meta[field] !== 'string' || !meta[field]) {
      throw new AppError('PROJECT_INVALID', `В meta отсутствует обязательное поле «${field}»`);
    }
  }

  if (!Array.isArray(value.testCases)) {
    throw new AppError('PROJECT_INVALID', 'Поле testCases должно быть массивом');
  }

  const formatVersion =
    typeof value.formatVersion === 'number' ? value.formatVersion : TC_TASK_FORMAT_VERSION;

  if (formatVersion > TC_TASK_FORMAT_VERSION) {
    throw new AppError(
      'PROJECT_INVALID',
      `Версия файла (${formatVersion}) новее поддерживаемой (${TC_TASK_FORMAT_VERSION})`,
    );
  }

  return {
    formatVersion: TC_TASK_FORMAT_VERSION,
    meta: {
      id: String(meta.id),
      name: String(meta.name),
      shortName: typeof meta.shortName === 'string' ? meta.shortName : '',
      description: typeof meta.description === 'string' ? meta.description : '',
      author: typeof meta.author === 'string' ? meta.author : '',
      testObject: typeof meta.testObject === 'string' ? meta.testObject : '',
      testObjectLinks: parseNamedLinks(meta.testObjectLinks),
      application: typeof meta.application === 'string' ? meta.application : '',
      testGoal: parseRichText(meta.testGoal),
      generalProvisions:
        typeof meta.generalProvisions === 'string' ? meta.generalProvisions : '',
      functionalRequirements: parseRichText(meta.functionalRequirements),
      createdAt: String(meta.createdAt),
      updatedAt: String(meta.updatedAt),
    },
    testCases: (value.testCases as TaskDocument['testCases']).map((testCase) => ({
      ...testCase,
      author: typeof testCase.author === 'string' ? testCase.author : '',
      developer: typeof testCase.developer === 'string' ? testCase.developer : '',
      businessAnalyst:
        typeof testCase.businessAnalyst === 'string' ? testCase.businessAnalyst : '',
      steps: normalizeStepsContent((testCase as { steps?: unknown }).steps),
    })),
  };
}

/** @deprecated use validateTaskDocument */
export const validateProjectDocument = validateTaskDocument;
