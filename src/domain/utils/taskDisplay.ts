import type { TaskMeta } from '@/domain/types/task';

/** Label for sidebar / compact UI: short name, else truncated full name. */
export function getTaskShortLabel(
  meta: Pick<TaskMeta, 'name' | 'shortName'> | { name: string; shortName?: string },
  maxNameLength = 48,
): string {
  const short = meta.shortName?.trim();
  if (short) {
    return short;
  }
  const name = meta.name?.trim() || 'Без названия';
  if (name.length <= maxNameLength) {
    return name;
  }
  return `${name.slice(0, maxNameLength - 1)}…`;
}
