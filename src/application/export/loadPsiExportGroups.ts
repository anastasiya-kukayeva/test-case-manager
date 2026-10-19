import type { RecentTask, TaskDocument } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { compareModuleNames } from '@/domain/utils/moduleOrder';
import { resolveTemplateId } from '@/templates/registry';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

export const PSI_EXPORT_UNASSIGNED_MODULE = 'Без модуля';

export type PsiExportTask = {
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  releaseNumber: string;
  module: string;
  caseCount: number;
  document: TaskDocument;
};

export type PsiExportModuleGroup = {
  moduleName: string;
  tasks: PsiExportTask[];
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

function toExportTask(document: TaskDocument): PsiExportTask {
  const meta = document.meta;
  return {
    taskId: meta.id,
    taskName: meta.name?.trim() || 'Без названия',
    taskShortLabel: getTaskShortLabel(meta),
    releaseNumber: meta.releaseNumber?.trim() || '',
    module: meta.module?.trim() || '',
    caseCount: document.testCases.filter((item) => !item.regressionOnly).length,
    document,
  };
}

function compareTasks(left: PsiExportTask, right: PsiExportTask): number {
  return left.taskShortLabel.localeCompare(right.taskShortLabel, 'ru');
}

/**
 * PSI tasks from the open task and recent files, grouped by module in directory order.
 */
export async function loadPsiExportGroups(): Promise<PsiExportModuleGroup[]> {
  const recentProjects = useAppStore.getState().recentProjects as RecentTask[];
  const current = useProjectStore.getState().current;
  const tasks: PsiExportTask[] = [];
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();

  const take = (document: TaskDocument, filePath: string | null) => {
    if (resolveTemplateId(document.meta.templateId) !== 'psi') {
      return;
    }
    if (seenIds.has(document.meta.id)) {
      return;
    }
    seenIds.add(document.meta.id);
    if (filePath) {
      seenPaths.add(filePath);
    }
    tasks.push(toExportTask(document));
  };

  if (current) {
    take(current.document, current.filePath);
  }

  for (const recent of recentProjects) {
    if (recent.filePath.startsWith('__unsaved__')) {
      continue;
    }
    if (seenPaths.has(recent.filePath) || seenIds.has(recent.id)) {
      continue;
    }
    if (!projectFileService.isAvailable()) {
      break;
    }
    try {
      const opened = await projectFileService.openFromPath(recent.filePath);
      seenPaths.add(opened.filePath);
      take(opened.document, opened.filePath);
    } catch {
      // Skip unreadable recent entries.
    }
  }

  const preferred = useDirectoryStore.getState().modules.map((item) => item.name);
  const named = tasks.filter((task) => task.module);
  const unassigned = tasks.filter((task) => !task.module).sort(compareTasks);
  const groups: PsiExportModuleGroup[] = orderModuleNames(
    preferred,
    named.map((task) => task.module),
  )
    .map((moduleName) => ({
      moduleName,
      tasks: named.filter((task) => sameName(task.module, moduleName)).sort(compareTasks),
    }))
    .sort((left, right) => compareModuleNames(left.moduleName, right.moduleName));

  if (unassigned.length > 0) {
    groups.push({ moduleName: PSI_EXPORT_UNASSIGNED_MODULE, tasks: unassigned });
  }

  return groups;
}
