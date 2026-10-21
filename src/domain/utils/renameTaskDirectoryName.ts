import type { TaskDocument } from '@/domain/types';

export type TaskDirectoryField = 'application' | 'module';

export function sameDirectoryName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('ru') === right.trim().toLocaleLowerCase('ru');
}

/** Replace a directory name stored on the task. Returns null when the task does not use it. */
export function renameTaskDirectoryName(
  document: TaskDocument,
  field: TaskDirectoryField,
  fromName: string,
  toName: string,
): TaskDocument | null {
  const current = document.meta[field]?.trim() ?? '';
  const next = toName.trim();
  if (!current || !next || !sameDirectoryName(current, fromName) || current === next) {
    return null;
  }

  return {
    ...document,
    meta: {
      ...document.meta,
      [field]: next,
      updatedAt: new Date().toISOString(),
    },
  };
}
