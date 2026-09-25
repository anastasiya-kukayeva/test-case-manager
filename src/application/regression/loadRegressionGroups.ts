import type { RecentTask, TestCase } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

export type RegressionMode = 'suite' | 'task';

export const REGRESSION_MODE_LABELS: Record<RegressionMode, string> = {
  suite: 'Регресс',
  task: 'Регресс задачи',
};

const UNASSIGNED_APPLICATION = 'Без приложения';
const UNASSIGNED_MODULE = 'Без модуля';

export function isRegressionMode(value: string | undefined): value is RegressionMode {
  return value === 'suite' || value === 'task';
}

export function matchesRegressionMode(testCase: TestCase, mode: RegressionMode): boolean {
  return mode === 'task' ? Boolean(testCase.includeInTaskRegression) : Boolean(testCase.includeInRegression);
}

export type RegressionTaskItem = {
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  taskFilePath: string | null;
  application: string;
  module: string;
  caseCount: number;
};

export type RegressionModuleGroup = {
  moduleName: string;
  tasks: RegressionTaskItem[];
};

export type RegressionApplicationGroup = {
  applicationName: string;
  modules: RegressionModuleGroup[];
};

type LoadedTask = {
  meta: { id: string; name: string; shortName?: string; application?: string; module?: string };
  filePath: string | null;
  testCases: TestCase[];
};

function orderedNames(preferred: string[], found: string[]): string[] {
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
    const hit = found.find((item) => item.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'));
    if (hit) {
      take(hit);
    }
  }
  for (const name of found) {
    take(name);
  }
  return result;
}

async function loadTasks(): Promise<LoadedTask[]> {
  const tasks: LoadedTask[] = [];
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const current = useProjectStore.getState().current;

  if (current) {
    tasks.push({
      meta: current.document.meta,
      filePath: current.filePath,
      testCases: current.document.testCases,
    });
    seenIds.add(current.document.meta.id);
    if (current.filePath) {
      seenPaths.add(current.filePath);
    }
  }

  for (const recent of useAppStore.getState().recentProjects as RecentTask[]) {
    if (!recent.filePath || recent.filePath.startsWith('__unsaved__')) {
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
      seenIds.add(opened.document.meta.id);
      tasks.push({
        meta: opened.document.meta,
        filePath: opened.filePath,
        testCases: opened.document.testCases,
      });
    } catch {
      // Skip unreadable task files.
    }
  }

  return tasks;
}

export async function loadRegressionGroups(mode: RegressionMode): Promise<RegressionApplicationGroup[]> {
  const directory = useDirectoryStore.getState();
  const items: RegressionTaskItem[] = [];

  for (const task of await loadTasks()) {
    const caseCount = task.testCases.filter((item) => matchesRegressionMode(item, mode)).length;
    if (caseCount === 0) {
      continue;
    }
    items.push({
      taskId: task.meta.id,
      taskName: task.meta.name,
      taskShortLabel: getTaskShortLabel(task.meta),
      taskFilePath: task.filePath,
      application: task.meta.application?.trim() || UNASSIGNED_APPLICATION,
      module: task.meta.module?.trim() || UNASSIGNED_MODULE,
      caseCount,
    });
  }

  const applicationNames = orderedNames(
    directory.applications.map((item) => item.name),
    items.map((item) => item.application),
  );
  const unassignedApp = applicationNames.filter((name) => name === UNASSIGNED_APPLICATION);
  const namedApps = applicationNames.filter((name) => name !== UNASSIGNED_APPLICATION);

  return [...namedApps, ...unassignedApp].map((applicationName) => {
    const appTasks = items.filter(
      (item) => item.application.toLocaleLowerCase('ru') === applicationName.toLocaleLowerCase('ru'),
    );
    const moduleNames = orderedNames(
      directory.modules.map((item) => item.name),
      appTasks.map((item) => item.module),
    );
    const unassignedModule = moduleNames.filter((name) => name === UNASSIGNED_MODULE);
    const namedModules = moduleNames.filter((name) => name !== UNASSIGNED_MODULE);

    return {
      applicationName,
      modules: [...namedModules, ...unassignedModule].map((moduleName) => ({
        moduleName,
        tasks: appTasks.filter(
          (item) => item.module.toLocaleLowerCase('ru') === moduleName.toLocaleLowerCase('ru'),
        ),
      })),
    };
  });
}
