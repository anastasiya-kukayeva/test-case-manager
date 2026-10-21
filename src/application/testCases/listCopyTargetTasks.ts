import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import type { RecentTask } from '@/domain/types';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

/** A task the copy dialog can write into. `current` is the task open right now. */
export type CopyTargetTask = {
  value: string;
  taskId: string;
  filePath: string | null;
  current: boolean;
  shortLabel: string;
  fullName: string;
};

const CURRENT_TASK_VALUE = 'current';

export function copyTargetLabel(task: CopyTargetTask): string {
  const full = task.fullName.trim();
  const base = full && full !== task.shortLabel ? `${task.shortLabel} — ${full}` : task.shortLabel;
  return task.current ? `${base} (текущая)` : base;
}

/** Open task first, then recent saved tasks. Skips unsaved entries that are not open. */
export function listCopyTargetTasks(): CopyTargetTask[] {
  const current = useProjectStore.getState().current;
  const recent = useAppStore.getState().recentProjects as RecentTask[];
  const tasks: CopyTargetTask[] = [];
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();

  if (current) {
    const meta = current.document.meta;
    const shortLabel = getTaskShortLabel(meta);
    tasks.push({
      value: CURRENT_TASK_VALUE,
      taskId: meta.id,
      filePath: current.filePath,
      current: true,
      shortLabel,
      fullName: meta.name.trim() || shortLabel,
    });
    seenIds.add(meta.id);
    if (current.filePath) {
      seenPaths.add(current.filePath);
    }
  }

  for (const item of recent) {
    if (!item.filePath || item.filePath.startsWith('__unsaved__')) {
      continue;
    }
    if (seenPaths.has(item.filePath) || seenIds.has(item.id)) {
      continue;
    }
    seenPaths.add(item.filePath);
    seenIds.add(item.id);
    const shortLabel = getTaskShortLabel(item);
    tasks.push({
      value: item.filePath,
      taskId: item.id,
      filePath: item.filePath,
      current: false,
      shortLabel,
      fullName: item.name.trim() || shortLabel,
    });
  }

  return tasks;
}
