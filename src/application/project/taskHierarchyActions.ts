import { nanoid } from 'nanoid';
import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { createEmptyTestCase } from '@/domain/factories/createEntities';
import type {
  ProjectDocument,
  RecentProject,
  RecentTask,
  TaskDocument,
  TestAttachment,
} from '@/domain/types';
import { TC_TASK_FILE_EXTENSION } from '@/domain/types';
import { canNestTask } from '@/domain/utils/taskTree';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

export type TaskHierarchyTarget = {
  id: string;
  name: string;
  shortName?: string;
  filePath: string | null;
  parentTaskId?: string | null;
};

function cloneAttachments(items: TestAttachment[]): TestAttachment[] {
  const now = new Date().toISOString();
  return items.map((item) => ({
    ...structuredClone(item),
    id: nanoid(),
    createdAt: now,
  }));
}

export function cloneTaskDocument(
  source: TaskDocument,
  options?: { nameSuffix?: string; parentTaskId?: string | null },
): TaskDocument {
  const now = new Date().toISOString();
  const suffix = options?.nameSuffix ?? ' (копия)';
  const sourceName = source.meta.name.trim();
  const sourceShort = source.meta.shortName.trim();
  const parentTaskId =
    options?.parentTaskId === undefined
      ? (source.meta.parentTaskId ?? null)
      : options.parentTaskId;

  return {
    formatVersion: source.formatVersion,
    meta: {
      ...source.meta,
      id: nanoid(),
      name: sourceName ? `${sourceName}${suffix}` : `Новая задача${suffix}`,
      shortName: sourceShort ? `${sourceShort}${suffix}`.slice(0, 80) : sourceShort,
      createdAt: now,
      updatedAt: now,
      parentTaskId,
    },
    testCases: source.testCases.map((testCase) => {
      const cloned = structuredClone(testCase);
      return createEmptyTestCase({
        ...cloned,
        id: nanoid(),
        goalImages: cloneAttachments(cloned.goalImages),
        verificationAttachments: cloneAttachments(cloned.verificationAttachments),
        createdAt: now,
        updatedAt: now,
      });
    }),
  };
}

function toRecent(document: ProjectDocument, filePath: string): RecentProject {
  return {
    id: document.meta.id || nanoid(),
    name: document.meta.name,
    shortName: document.meta.shortName?.trim() || undefined,
    filePath,
    openedAt: new Date().toISOString(),
    parentTaskId: document.meta.parentTaskId || null,
  };
}

function isCurrentTask(
  task: { id: string; filePath: string | null },
  current: { filePath: string | null; document: { meta: { id: string } } } | null,
): boolean {
  if (!current) {
    return false;
  }
  if (task.filePath && current.filePath && task.filePath === current.filePath) {
    return true;
  }
  return current.document.meta.id === task.id;
}

async function persistRecent(next: RecentProject[]): Promise<void> {
  useAppStore.getState().setRecentProjects(next);
  if (appStorageService.isAvailable()) {
    await appStorageService.saveRecentProjects(next);
  }
}

function suggestedCopyPath(filePath: string | null, label: string): string | undefined {
  const safeLabel = label
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);

  if (!filePath) {
    const defaultDir = useAppStore.getState().settings.storage.defaultProjectsDirectory;
    return defaultDir ? `${defaultDir}\\${safeLabel || 'task'} копия.${TC_TASK_FILE_EXTENSION}` : undefined;
  }

  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const dir = lastSlash >= 0 ? filePath.slice(0, lastSlash + 1) : '';
  const filename = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const withoutExt = filename.replace(/\.(tctask|tcproj)$/i, '');
  return `${dir}${withoutExt} копия.${TC_TASK_FILE_EXTENSION}`;
}

async function readSourceDocument(task: TaskHierarchyTarget): Promise<TaskDocument> {
  const current = useProjectStore.getState().current;
  if (isCurrentTask(task, current) && current) {
    return current.document;
  }
  if (!task.filePath || task.filePath.startsWith('__unsaved__')) {
    throw new AppError('NOT_FOUND', 'Сначала сохраните задачу, затем скопируйте её');
  }
  if (!projectFileService.isAvailable()) {
    throw new AppError('IPC_UNAVAILABLE', 'Копирование файлов доступно только в Electron');
  }
  const opened = await projectFileService.openFromPath(task.filePath);
  return opened.document;
}

export const taskHierarchyActions = {
  async duplicate(task: TaskHierarchyTarget): Promise<boolean> {
    try {
      if (!projectFileService.isAvailable()) {
        throw new AppError('IPC_UNAVAILABLE', 'Копирование файлов доступно только в Electron');
      }

      const source = await readSourceDocument(task);
      const clone = cloneTaskDocument(source);
      const label = clone.meta.shortName.trim() || clone.meta.name.trim() || 'task';
      const saved = await projectFileService.saveWithDialog(
        clone,
        suggestedCopyPath(task.filePath, label),
      );
      if (!saved) {
        return false;
      }

      const recent = useAppStore.getState().recentProjects;
      const entry = toRecent(saved.document, saved.filePath);
      const next = [entry, ...recent.filter((item) => item.filePath !== saved.filePath)].slice(0, 10);
      await persistRecent(next);
      notifySuccess(`Создана копия «${clone.meta.name}»`);
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось скопировать задачу' });
      return false;
    }
  },

  async move(task: TaskHierarchyTarget, newParentId: string | null): Promise<boolean> {
    try {
      const recent = useAppStore.getState().recentProjects as RecentTask[];
      const normalizedParent = newParentId?.trim() || null;

      if (!canNestTask(recent, task.id, normalizedParent)) {
        throw new AppError(
          'VALIDATION',
          'Нельзя переместить задачу внутрь самой себя или своей подзадачи',
        );
      }

      const current = useProjectStore.getState().current;
      const movingCurrent = isCurrentTask(task, current);

      if (movingCurrent && current) {
        useProjectStore.getState().updateProjectMeta({ parentTaskId: normalizedParent });
        if (current.filePath) {
          await projectActions.save({ silent: true });
        }
      } else {
        if (!task.filePath || task.filePath.startsWith('__unsaved__')) {
          throw new AppError('NOT_FOUND', 'Сначала сохраните задачу, затем переместите её');
        }
        if (!projectFileService.isAvailable()) {
          throw new AppError('IPC_UNAVAILABLE', 'Перемещение доступно только в Electron');
        }
        const opened = await projectFileService.openFromPath(task.filePath);
        const nextDocument: TaskDocument = {
          ...opened.document,
          meta: {
            ...opened.document.meta,
            parentTaskId: normalizedParent,
            updatedAt: new Date().toISOString(),
          },
        };
        await projectFileService.saveToPath(task.filePath, nextDocument);
      }

      const nextRecent = recent.map((item) => {
        const sameFile = Boolean(task.filePath) && item.filePath === task.filePath;
        const sameId = item.id === task.id;
        if (!sameFile && !sameId) {
          return item;
        }
        return { ...item, parentTaskId: normalizedParent };
      });
      await persistRecent(nextRecent);

      notifySuccess(
        normalizedParent ? 'Задача перемещена в подзадачи' : 'Задача перемещена на верхний уровень',
      );
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось переместить задачу' });
      return false;
    }
  },
};
