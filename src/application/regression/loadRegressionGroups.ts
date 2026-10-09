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

export function isRegressionMode(value: string | undefined): value is RegressionMode {
  return value === 'suite' || value === 'task';
}

export function matchesRegressionMode(testCase: TestCase, mode: RegressionMode): boolean {
  return mode === 'task' ? Boolean(testCase.includeInTaskRegression) : Boolean(testCase.includeInRegression);
}

export const UNASSIGNED_MODULE = 'Без модуля';

export type RegressionCaseItem = {
  id: string;
  number: string;
  title: string;
  goal: TestCase['goal'];
  createdAt: string;
  updatedAt: string;
  testOutcome: TestCase['testOutcome'];
  includeInReport: boolean;
  includeInRegression: boolean;
  includeInTaskRegression: boolean;
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  taskFilePath: string | null;
  /** Application name from the parent task. */
  application: string;
  module: string;
};

export type RegressionTaskGroup = {
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  taskFilePath: string | null;
  cases: RegressionCaseItem[];
};

export type RegressionModuleCases = {
  moduleName: string;
  tasks: RegressionTaskGroup[];
};

export type RegressionCasesByModule = {
  modules: RegressionModuleCases[];
  unassigned: RegressionTaskGroup[];
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

export async function loadRegressionCasesByModule(mode: RegressionMode): Promise<RegressionCasesByModule> {
  const directory = useDirectoryStore.getState();
  const cases: RegressionCaseItem[] = [];

  for (const task of await loadTasks()) {
    const moduleName = task.meta.module?.trim() || UNASSIGNED_MODULE;
    for (const testCase of task.testCases) {
      if (!matchesRegressionMode(testCase, mode)) {
        continue;
      }
      cases.push({
        id: testCase.id,
        number: testCase.number,
        title: testCase.title,
        goal: testCase.goal,
        createdAt: testCase.createdAt,
        updatedAt: testCase.updatedAt,
        testOutcome: testCase.testOutcome,
        includeInReport: testCase.includeInReport !== false,
        includeInRegression: Boolean(testCase.includeInRegression),
        includeInTaskRegression: Boolean(testCase.includeInTaskRegression),
        taskId: task.meta.id,
        taskName: task.meta.name,
        taskShortLabel: getTaskShortLabel(task.meta),
        taskFilePath: task.filePath,
        application: task.meta.application?.trim() ?? '',
        module: moduleName,
      });
    }
  }

  const named = cases.filter((item) => item.module !== UNASSIGNED_MODULE);
  const unassigned = cases.filter((item) => item.module === UNASSIGNED_MODULE);
  const moduleNames = orderedNames(
    directory.modules.map((item) => item.name),
    named.map((item) => item.module),
  );

  return {
    modules: moduleNames.map((moduleName) => ({
      moduleName,
      tasks: groupCasesByTask(
        named.filter(
          (item) => item.module.toLocaleLowerCase('ru') === moduleName.toLocaleLowerCase('ru'),
        ),
      ),
    })),
    unassigned: groupCasesByTask(unassigned),
  };
}

function groupCasesByTask(cases: RegressionCaseItem[]): RegressionTaskGroup[] {
  const groups: RegressionTaskGroup[] = [];
  const indexByTask = new Map<string, number>();
  for (const item of cases) {
    const existing = indexByTask.get(item.taskId);
    if (existing === undefined) {
      indexByTask.set(item.taskId, groups.length);
      groups.push({
        taskId: item.taskId,
        taskName: item.taskName,
        taskShortLabel: item.taskShortLabel,
        taskFilePath: item.taskFilePath,
        cases: [item],
      });
      continue;
    }
    groups[existing]?.cases.push(item);
  }
  return groups;
}
