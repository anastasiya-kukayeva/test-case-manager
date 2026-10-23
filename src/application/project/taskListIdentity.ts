import type { RecentTask } from '@/domain/types';

export function sameFilePath(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }
  const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return normalize(left) === normalize(right);
}

/** Id shown in the workspace list. A copied file keeps `id::path` until it gets its own id. */
export function canonicalListedTaskId(id: string, filePath: string): string {
  const marker = `::${filePath}`;
  if (id.endsWith(marker) && id.length > marker.length) {
    return id.slice(0, -marker.length);
  }
  return id;
}

/**
 * Files that share an id with another file and must be given a new one.
 * The file that already owns the plain id stays as it is.
 */
export function duplicateTaskFilesToReassign(
  tasks: Array<Pick<RecentTask, 'id' | 'filePath'>>,
): string[] {
  const groups = new Map<string, Array<Pick<RecentTask, 'id' | 'filePath'>>>();
  for (const task of tasks) {
    const key = canonicalListedTaskId(task.id, task.filePath);
    const group = groups.get(key) ?? [];
    group.push(task);
    groups.set(key, group);
  }

  const paths: string[] = [];
  for (const [canonical, group] of groups) {
    if (group.length < 2) {
      continue;
    }
    const owner = group.find((item) => item.id === canonical) ?? group[0];
    for (const item of group) {
      if (!sameFilePath(item.filePath, owner.filePath)) {
        paths.push(item.filePath);
      }
    }
  }
  return paths;
}

type OpenTaskNames = {
  filePath: string | null;
  document: {
    meta: {
      name: string;
      shortName?: string;
      parentTaskId?: string | null;
    };
  };
};

/** Live title of the open task replaces only the row of that same file. */
export function overlayOpenTask(tasks: RecentTask[], current: OpenTaskNames | null): RecentTask[] {
  if (!current?.filePath) {
    return tasks;
  }
  return tasks.map((item) => {
    if (!sameFilePath(item.filePath, current.filePath)) {
      return item;
    }
    return {
      ...item,
      name: current.document.meta.name,
      shortName: current.document.meta.shortName || item.shortName,
      parentTaskId: current.document.meta.parentTaskId ?? item.parentTaskId,
    };
  });
}
