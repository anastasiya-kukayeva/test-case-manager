import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WorkspaceTaskSummary } from './ipc/channels';

const TASK_EXTENSIONS = ['.tctask', '.tcproj'];
const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'release',
  '.tcm',
]);
const MAX_DEPTH = 8;
const MAX_TASKS = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTaskFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return TASK_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function summarizeTaskContent(
  filePath: string,
  content: string,
): WorkspaceTaskSummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const root = isRecord(parsed) ? parsed : null;
  if (!root) {
    return null;
  }

  const envelopeDocument =
    (root.magic === 'TCM_TASK' || root.magic === 'TCM_PROJECT') && isRecord(root.document)
      ? root.document
      : null;
  const plainDocument = isRecord(root.meta) && Array.isArray(root.testCases) ? root : null;
  const document = envelopeDocument ?? plainDocument;
  if (!document) {
    return null;
  }

  const meta = isRecord(document.meta) ? document.meta : null;
  if (!meta) {
    return null;
  }

  const stem =
    path
      .basename(filePath)
      .replace(/\.(tctask|tcproj)$/i, '')
      .trim() || 'Задача';
  const name = typeof meta.name === 'string' && meta.name.trim() ? meta.name.trim() : stem;
  const id = typeof meta.id === 'string' && meta.id.trim() ? meta.id.trim() : filePath;
  const shortName = typeof meta.shortName === 'string' ? meta.shortName.trim() : '';
  const parentRaw = meta.parentTaskId;
  const parentTaskId = typeof parentRaw === 'string' && parentRaw.trim() ? parentRaw.trim() : null;
  const updatedAt = typeof meta.updatedAt === 'string' ? meta.updatedAt : '';

  return {
    filePath,
    id,
    name: name.slice(0, 2000),
    shortName: shortName.slice(0, 80),
    parentTaskId,
    updatedAt,
  };
}

async function walkTasks(
  dirPath: string,
  depth: number,
  out: WorkspaceTaskSummary[],
): Promise<void> {
  if (depth > MAX_DEPTH || out.length > MAX_TASKS) {
    return;
  }

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (out.length > MAX_TASKS) {
      return;
    }
    if (entry.name.startsWith('.')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name.toLowerCase())) {
        continue;
      }
      await walkTasks(fullPath, depth + 1, out);
      continue;
    }

    if (!entry.isFile() || !isTaskFileName(entry.name)) {
      continue;
    }

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const summary = summarizeTaskContent(fullPath, content);
      if (summary) {
        out.push(summary);
      }
    } catch {
      // Skip unreadable or locked files; the rest of the folder still loads.
    }
  }
}

export async function listWorkspaceTasks(dirPath: string): Promise<WorkspaceTaskSummary[]> {
  if (typeof dirPath !== 'string' || !dirPath.trim()) {
    throw new Error('Рабочая папка не указана');
  }

  const root = dirPath.trim();
  let stat;
  try {
    stat = await fs.stat(root);
  } catch {
    throw new Error(`Рабочая папка недоступна:\n${root}`);
  }

  if (!stat.isDirectory()) {
    throw new Error('Указанный путь не является папкой');
  }

  const tasks: WorkspaceTaskSummary[] = [];
  await walkTasks(root, 0, tasks);

  if (tasks.length > MAX_TASKS) {
    throw new Error(
      'В рабочей папке слишком много файлов задач (больше 2000). Укажите папку, где лежат задачи.',
    );
  }

  return tasks;
}
