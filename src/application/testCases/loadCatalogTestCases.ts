import type { TestCase, RecentTask } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

export type CatalogTestCaseRow = TestCase & {
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  taskFilePath: string | null;
};

export type CatalogTaskGroup = {
  taskId: string;
  taskName: string;
  taskShortLabel: string;
  taskFilePath: string | null;
  testCases: CatalogTestCaseRow[];
};

function toCatalogRows(
  testCases: TestCase[],
  meta: { id: string; name: string; shortName?: string },
  filePath: string | null,
): CatalogTestCaseRow[] {
  const taskShortLabel = getTaskShortLabel(meta);
  return testCases.map((testCase) => ({
    ...testCase,
    taskId: meta.id,
    taskName: meta.name,
    taskShortLabel,
    taskFilePath: filePath,
  }));
}

/**
 * Collect test cases from the open task (in-memory) and all recent task files,
 * grouped by task. Does not switch the currently open task.
 */
export async function loadCatalogTestCaseGroups(): Promise<CatalogTaskGroup[]> {
  const recentProjects = useAppStore.getState().recentProjects;
  const current = useProjectStore.getState().current;
  const groups: CatalogTaskGroup[] = [];
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();

  if (current) {
    const meta = current.document.meta;
    const filePath = current.filePath;
    groups.push({
      taskId: meta.id,
      taskName: meta.name,
      taskShortLabel: getTaskShortLabel(meta),
      taskFilePath: filePath,
      testCases: toCatalogRows(current.document.testCases, meta, filePath),
    });
    seenIds.add(meta.id);
    if (filePath) {
      seenPaths.add(filePath);
    }
  }

  for (const recent of recentProjects as RecentTask[]) {
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
      const meta = document.meta;
      seenPaths.add(filePath);
      seenIds.add(meta.id);
      groups.push({
        taskId: meta.id,
        taskName: meta.name,
        taskShortLabel: getTaskShortLabel(meta),
        taskFilePath: filePath,
        testCases: toCatalogRows(document.testCases, meta, filePath),
      });
    } catch {
      // Skip missing or unreadable files.
    }
  }

  return groups.filter((group) => group.testCases.length > 0);
}
