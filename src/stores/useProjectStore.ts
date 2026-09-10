import { create } from 'zustand';
import {
  renumberTestCases,
  reorderTestCasesByIds,
} from '@/application/testCases/renumberTestCases';
import { createEmptyProjectDocument } from '@/domain/factories/createEntities';
import type {
  OpenProjectState,
  ProjectDocument,
  ProjectMeta,
  RecentProject,
  TestCase,
} from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { useAppStore } from '@/stores/useAppStore';

type ProjectStoreState = {
  current: OpenProjectState | null;
  createInMemoryProject: (name?: string) => void;
  setCurrentDocument: (document: ProjectDocument, filePath?: string | null) => void;
  updateProjectMeta: (partial: Partial<ProjectMeta>) => void;
  updateDocument: (document: ProjectDocument) => void;
  addTestCase: (testCase: TestCase) => void;
  updateTestCase: (id: string, partial: Partial<TestCase>) => void;
  deleteTestCases: (ids: string[]) => void;
  /** Reorder by id list (full or filtered subset) and renumber 1..n. */
  reorderTestCases: (orderedIds: string[]) => void;
  markDirty: () => void;
  markSaved: (filePath?: string | null) => void;
  closeProject: () => void;
  rememberRecent: (project: RecentProject, options?: { bumpToFront?: boolean }) => Promise<void>;
};

function withUpdatedTestCases(
  current: OpenProjectState,
  testCases: TestCase[],
): OpenProjectState {
  const now = new Date().toISOString();
  return {
    ...current,
    isDirty: true,
    document: {
      ...current.document,
      testCases,
      meta: {
        ...current.document.meta,
        updatedAt: now,
      },
    },
  };
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  current: null,

  createInMemoryProject: (name = 'Новая задача') => {
    const document = createEmptyProjectDocument({
      meta: { name },
    });

    set({
      current: {
        document,
        filePath: null,
        isDirty: true,
        lastSavedAt: null,
      },
    });
  },

  setCurrentDocument: (document, filePath = null) => {
    set({
      current: {
        document,
        filePath,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
      },
    });
  },

  updateProjectMeta: (partial) => {
    const current = get().current;
    if (!current) {
      return;
    }

    set({
      current: {
        ...current,
        isDirty: true,
        document: {
          ...current.document,
          meta: {
            ...current.document.meta,
            ...partial,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  },

  updateDocument: (document) => {
    const current = get().current;
    if (!current) {
      return;
    }

    set({
      current: {
        ...current,
        isDirty: true,
        document: {
          ...document,
          meta: {
            ...document.meta,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  },

  addTestCase: (testCase) => {
    const current = get().current;
    if (!current) {
      return;
    }

    set({
      current: withUpdatedTestCases(
        current,
        renumberTestCases([...current.document.testCases, testCase]),
      ),
    });
  },

  updateTestCase: (id, partial) => {
    const current = get().current;
    if (!current) {
      return;
    }

    const testCases = current.document.testCases.map((item) =>
      item.id === id
        ? {
            ...item,
            ...partial,
            id: item.id,
            updatedAt: partial.updatedAt ?? new Date().toISOString(),
          }
        : item,
    );

    set({ current: withUpdatedTestCases(current, testCases) });
  },

  deleteTestCases: (ids) => {
    const current = get().current;
    if (!current) {
      return;
    }

    const idSet = new Set(ids);
    const testCases = renumberTestCases(
      current.document.testCases.filter((item) => !idSet.has(item.id)),
    );
    set({ current: withUpdatedTestCases(current, testCases) });
  },

  reorderTestCases: (orderedIds) => {
    const current = get().current;
    if (!current || orderedIds.length === 0) {
      return;
    }

    const reordered = reorderTestCasesByIds(current.document.testCases, orderedIds);
    set({
      current: withUpdatedTestCases(current, renumberTestCases(reordered)),
    });
  },

  markDirty: () => {
    const current = get().current;
    if (!current) {
      return;
    }

    set({
      current: {
        ...current,
        isDirty: true,
        document: {
          ...current.document,
          meta: {
            ...current.document.meta,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });
  },

  markSaved: (filePath) => {
    const current = get().current;
    if (!current) {
      return;
    }

    const now = new Date().toISOString();

    set({
      current: {
        ...current,
        isDirty: false,
        filePath: filePath === undefined ? current.filePath : filePath,
        lastSavedAt: now,
        document: {
          ...current.document,
          meta: {
            ...current.document.meta,
            updatedAt: now,
          },
        },
      },
    });
  },

  closeProject: () => {
    set({ current: null });
  },

  rememberRecent: async (project, options) => {
    const bumpToFront = options?.bumpToFront ?? true;
    try {
      if (!appStorageService.isAvailable()) {
        const current = useAppStore.getState().recentProjects;
        const existingIndex = current.findIndex((item) => item.filePath === project.filePath);
        let next: RecentProject[];
        if (existingIndex >= 0 && !bumpToFront) {
          next = current.map((item, index) =>
            index === existingIndex ? { ...item, ...project } : item,
          );
        } else {
          const existing = existingIndex >= 0 ? current[existingIndex] : null;
          next = [
            { ...(existing ?? {}), ...project },
            ...current.filter((item) => item.filePath !== project.filePath),
          ].slice(0, 10);
        }
        useAppStore.getState().setRecentProjects(next);
        return;
      }

      const next = await appStorageService.addRecentProject(project, 10, { bumpToFront });
      useAppStore.getState().setRecentProjects(next);
      await appStorageService.setLastOpenedProjectPath(project.filePath);
    } catch {
      // Persistence errors are non-fatal for in-memory project state.
    }
  },
}));
