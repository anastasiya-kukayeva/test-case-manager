import { nanoid } from 'nanoid';
import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess, notifyWarning } from '@/application/errors/errorHandler';
import { createEmptyProjectDocument } from '@/domain/factories/createEntities';
import type { ProjectDocument, RecentProject, RichTextContent } from '@/domain/types';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { recoveryService } from '@/infrastructure/project/recoveryService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

export type CreateProjectInput = {
  name: string;
  shortName?: string;
  application?: string;
  module?: string;
  testObject?: string;
  testGoal?: RichTextContent;
  generalProvisions?: string;
  functionalRequirements?: RichTextContent;
  risksAndLimitations?: RichTextContent;
  /** @deprecated */
  description?: string;
  /** @deprecated */
  author?: string;
};

/** Persist dirty task to disk without asking; used before switch/close/leave. */
async function ensureCurrentSaved(): Promise<boolean> {
  return projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
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

export const projectActions = {
  async create(input: CreateProjectInput): Promise<boolean> {
    try {
      const canProceed = await ensureCurrentSaved();
      if (!canProceed) {
        return false;
      }

      const document = createEmptyProjectDocument({
        meta: {
          name: input.name.trim() || 'Новая задача',
          shortName: input.shortName?.trim() ?? '',
          description: input.description?.trim() ?? '',
          author: input.author?.trim() ?? '',
          application: input.application?.trim() ?? '',
          module: input.module?.trim() ?? '',
          testObject: input.testObject?.trim() ?? '',
          testGoal: input.testGoal,
          generalProvisions: input.generalProvisions?.trim() ?? '',
          functionalRequirements: input.functionalRequirements,
          risksAndLimitations: input.risksAndLimitations,
        },
      });

      useProjectStore.getState().setCurrentDocument(document, null);
      useProjectStore.getState().markDirty();
      await recoveryService.writeSnapshot(document, null);

      // Without saving to disk the task lives only in memory / recovery and will
      // disappear after restart or when another task is opened.
      if (projectFileService.isAvailable()) {
        const saved = await this.saveAs({ silent: true });
        if (saved) {
          notifySuccess(`Задача «${document.meta.name}» создана и сохранена`);
        } else {
          notifyWarning(
            'Задача создана, но файл не сохранён. Сохраните её (Ctrl+S), иначе она пропадёт после закрытия приложения.',
            'Задача только в памяти',
          );
        }
      } else {
        notifyWarning(
          'Задача создана в памяти. Запустите приложение через Electron (npm run dev) и сохраните файл, иначе она пропадёт.',
          'Нет доступа к файлам',
        );
      }

      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось создать задачу' });
      return false;
    }
  },

  async open(): Promise<boolean> {
    try {
      if (!projectFileService.isAvailable()) {
        throw new AppError('IPC_UNAVAILABLE', 'Открытие файлов доступно только в Electron');
      }

      const canProceed = await ensureCurrentSaved();
      if (!canProceed) {
        return false;
      }

      const defaultDir = useAppStore.getState().settings.storage.defaultProjectsDirectory ?? undefined;
      const opened = await projectFileService.openWithDialog(defaultDir ?? undefined);
      if (!opened) {
        return false;
      }

      useProjectStore.getState().setCurrentDocument(opened.document, opened.filePath);
      await useProjectStore.getState().rememberRecent(toRecent(opened.document, opened.filePath));
      await recoveryService.clear();
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось открыть задачу' });
      return false;
    }
  },

  async openRecent(
    filePath: string,
    options?: { preserveRecentOrder?: boolean },
  ): Promise<boolean> {
    try {
      const canProceed = await ensureCurrentSaved();
      if (!canProceed) {
        return false;
      }

      const opened = await projectFileService.openFromPath(filePath);
      useProjectStore.getState().setCurrentDocument(opened.document, opened.filePath);
      await useProjectStore.getState().rememberRecent(
        toRecent(opened.document, opened.filePath),
        { bumpToFront: !options?.preserveRecentOrder },
      );
      await recoveryService.clear();
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось открыть недавнюю задачу' });
      return false;
    }
  },

  /** Save dirty task to its file. No-op if clean. Optional Save As only when allowSaveAs. */
  async saveIfDirty(options?: {
    silent?: boolean;
    /** If true and there is no file path yet, open Save As. Default: false (recovery only). */
    allowSaveAs?: boolean;
  }): Promise<boolean> {
    const current = useProjectStore.getState().current;
    if (!current?.isDirty) {
      return true;
    }

    if (!projectFileService.isAvailable()) {
      await this.writeAutosaveSnapshot();
      return true;
    }

    if (!current.filePath) {
      if (options?.allowSaveAs) {
        return this.saveAs({ silent: true });
      }
      await this.writeAutosaveSnapshot();
      return true;
    }

    return this.save({ silent: options?.silent ?? true });
  },

  async save(options?: { silent?: boolean }): Promise<boolean> {
    try {
      const current = useProjectStore.getState().current;
      if (!current) {
        throw new AppError('NOT_FOUND', 'Нет открытой задачи для сохранения');
      }

      if (!projectFileService.isAvailable()) {
        throw new AppError('IPC_UNAVAILABLE', 'Сохранение доступно только в Electron');
      }

      if (!current.filePath) {
        return this.saveAs({ silent: options?.silent });
      }

      const savedPath = await projectFileService.saveToPath(current.filePath, current.document);
      useProjectStore.getState().markSaved(savedPath);
      await useProjectStore.getState().rememberRecent(toRecent(current.document, savedPath));
      await recoveryService.clear();
      if (!options?.silent) {
        notifySuccess('Задача сохранена');
      }
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось сохранить задачу' });
      return false;
    }
  },

  async saveAs(options?: { silent?: boolean }): Promise<boolean> {
    try {
      const current = useProjectStore.getState().current;
      if (!current) {
        throw new AppError('NOT_FOUND', 'Нет открытой задачи для сохранения');
      }

      if (!projectFileService.isAvailable()) {
        throw new AppError('IPC_UNAVAILABLE', 'Сохранение доступно только в Electron');
      }

      const defaultDir = useAppStore.getState().settings.storage.defaultProjectsDirectory;
      const label =
        current.document.meta.shortName?.trim() ||
        current.document.meta.name.trim() ||
        'task';
      const safeLabel = label
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
      const defaultPath = current.filePath
        ?? (defaultDir ? `${defaultDir}\\${safeLabel || 'task'}.tctask` : undefined);

      const saved = await projectFileService.saveWithDialog(current.document, defaultPath);
      if (!saved) {
        return false;
      }

      useProjectStore.getState().markSaved(saved.filePath);
      await useProjectStore.getState().rememberRecent(toRecent(current.document, saved.filePath));
      await recoveryService.clear();
      if (!options?.silent) {
        notifySuccess(`Задача сохранена как «${saved.filePath}»`);
      }
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось сохранить задачу' });
      return false;
    }
  },

  async close(): Promise<boolean> {
    try {
      const canProceed = await ensureCurrentSaved();
      if (!canProceed) {
        return false;
      }

      useProjectStore.getState().closeProject();
      await recoveryService.clear();
      notifySuccess('Задача закрыта');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось закрыть задачу' });
      return false;
    }
  },

  async restoreFromRecovery(snapshot: {
    document: ProjectDocument;
    originalFilePath: string | null;
  }): Promise<void> {
    useProjectStore.getState().setCurrentDocument(snapshot.document, snapshot.originalFilePath);
    useProjectStore.getState().markDirty();
    // Clear the crash file so the next launch does not re-prompt with the same snapshot.
    await recoveryService.clear();
    // Immediately write a fresh recovery snapshot while the restored task stays dirty.
    await recoveryService.writeSnapshot(snapshot.document, snapshot.originalFilePath);
    notifySuccess('Задача восстановлена после аварийного закрытия');
  },

  async discardRecovery(): Promise<void> {
    await recoveryService.clear();
  },

  async writeAutosaveSnapshot(): Promise<void> {
    const current = useProjectStore.getState().current;
    if (!current?.isDirty) {
      return;
    }

    await recoveryService.writeSnapshot(current.document, current.filePath);
  },
};
