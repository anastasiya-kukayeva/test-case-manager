import type { RecentTask } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

export const UNASSIGNED_APPLICATION_MODULE = 'Без модуля';

export type ApplicationTaskItem = {
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  taskFilePath: string | null;
  application: string;
  /** Module name from the task. Empty when the task has no module. */
  module: string;
};

export type ApplicationModuleGroup = {
  moduleName: string;
  tasks: ApplicationTaskItem[];
};

export type ApplicationGroup = {
  applicationId: string | null;
  applicationName: string;
  modules: ApplicationModuleGroup[];
};

function sameName(left: string, right: string): boolean {
  return left.toLocaleLowerCase('ru') === right.toLocaleLowerCase('ru');
}

function orderModuleNames(preferred: string[], found: string[]): string[] {
  const result: string[] = [];
  const used = new Set<string>();
  const take = (name: string) => {
    const key = name.toLocaleLowerCase('ru');
    if (used.has(key)) {
      return;
    }
    used.add(key);
    result.push(name);
  };

  for (const name of preferred) {
    const hit = found.find((item) => sameName(item, name));
    if (hit) {
      take(hit);
    }
  }
  for (const name of found) {
    take(name);
  }
  return result;
}

function groupTasksByModule(tasks: ApplicationTaskItem[]): ApplicationModuleGroup[] {
  const preferred = useDirectoryStore.getState().modules.map((item) => item.name);
  const named = tasks.filter((task) => task.module);
  const unassigned = tasks.filter((task) => !task.module);
  const groups = orderModuleNames(
    preferred,
    named.map((task) => task.module),
  ).map((moduleName) => ({
    moduleName,
    tasks: named.filter((task) => sameName(task.module, moduleName)),
  }));

  if (unassigned.length > 0) {
    groups.push({ moduleName: UNASSIGNED_APPLICATION_MODULE, tasks: unassigned });
  }
  return groups;
}

function toTaskItem(
  meta: { id: string; name: string; shortName?: string; application?: string; module?: string },
  filePath: string | null,
): ApplicationTaskItem {
  return {
    taskId: meta.id,
    taskName: meta.name,
    taskShortLabel: getTaskShortLabel(meta),
    taskFilePath: filePath,
    application: meta.application?.trim() || '',
    module: meta.module?.trim() || '',
  };
}

/**
 * Build application → tasks groups from the directory and recent/open task files.
 */
export async function loadApplicationTaskGroups(): Promise<ApplicationGroup[]> {
  const directoryApps = useDirectoryStore.getState().applications;
  const recentProjects = useAppStore.getState().recentProjects as RecentTask[];
  const current = useProjectStore.getState().current;

  const tasks: ApplicationTaskItem[] = [];
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();

  if (current) {
    const meta = current.document.meta;
    tasks.push(toTaskItem(meta, current.filePath));
    seenIds.add(meta.id);
    if (current.filePath) {
      seenPaths.add(current.filePath);
    }
  }

  for (const recent of recentProjects) {
    if (recent.filePath.startsWith('__unsaved__')) {
      continue;
    }
    if (seenPaths.has(recent.filePath) || seenIds.has(recent.id)) {
      continue;
    }

    try {
      if (!projectFileService.isAvailable()) {
        break;
      }
      const { document, filePath } = await projectFileService.openFromPath(recent.filePath);
      seenPaths.add(filePath);
      seenIds.add(document.meta.id);
      tasks.push(toTaskItem(document.meta, filePath));
    } catch {
      // Skip unreadable recent entries.
    }
  }

  const groups: ApplicationGroup[] = directoryApps.map((app) => ({
    applicationId: app.id,
    applicationName: app.name,
    modules: groupTasksByModule(
      tasks.filter((task) => sameName(task.application, app.name)),
    ),
  }));

  const knownNames = new Set(
    directoryApps.map((app) => app.name.toLocaleLowerCase('ru')),
  );
  const orphanTasks = tasks.filter(
    (task) => task.application && !knownNames.has(task.application.toLocaleLowerCase('ru')),
  );

  if (orphanTasks.length > 0) {
    const byName = new Map<string, ApplicationTaskItem[]>();
    for (const task of orphanTasks) {
      const key = task.application;
      const list = byName.get(key) ?? [];
      list.push(task);
      byName.set(key, list);
    }
    for (const [name, appTasks] of byName) {
      groups.push({
        applicationId: null,
        applicationName: name,
        modules: groupTasksByModule(appTasks),
      });
    }
  }

  const unassigned = tasks.filter((task) => !task.application);
  if (unassigned.length > 0) {
    groups.push({
      applicationId: null,
      applicationName: 'Без приложения',
      modules: groupTasksByModule(unassigned),
    });
  }

  return groups;
}
