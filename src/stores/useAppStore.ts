import { create } from 'zustand';
import { notifyError } from '@/application/errors/errorHandler';
import { isHiddenTaskFile, withoutHiddenTaskFiles } from '@/application/project/taskListIdentity';
import { DEFAULT_APP_SETTINGS, type AppSettings, type RecentProject } from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { normalizeWorkspaceDirectory } from '@/infrastructure/workspace/paths';
import { readWorkspaceTaskList } from '@/infrastructure/workspace/workspaceCatalog';

type AppStoreState = {
  settings: AppSettings;
  recentProjects: RecentProject[];
  hiddenTaskFilePaths: string[];
  isInitialized: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  setSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setRecentProjects: (projects: RecentProject[]) => void;
  refreshRecentProjects: () => Promise<boolean>;
  hideTaskFile: (filePath: string) => Promise<void>;
  revealTaskFile: (filePath: string) => Promise<void>;
};

let ongoingInitialize: Promise<void> | null = null;

export const useAppStore = create<AppStoreState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  recentProjects: [],
  hiddenTaskFilePaths: [],
  isInitialized: false,
  isLoading: false,

  initialize: () => {
    if (get().isInitialized) {
      return Promise.resolve();
    }
    if (ongoingInitialize) {
      return ongoingInitialize;
    }

    const run = (async () => {
      set({ isLoading: true });

      try {
        if (!appStorageService.isAvailable()) {
          set({
            settings: DEFAULT_APP_SETTINGS,
            recentProjects: [],
            hiddenTaskFilePaths: [],
            isInitialized: true,
            isLoading: false,
          });
          return;
        }

        const [settings, storedRecent, hiddenTaskFilePaths] = await Promise.all([
          appStorageService.getSettings(),
          appStorageService.getRecentProjects(),
          appStorageService.getHiddenTaskFilePaths(),
        ]);

        let recentProjects = storedRecent;
        const workspaceDir = normalizeWorkspaceDirectory(settings.storage.defaultProjectsDirectory);
        if (workspaceDir) {
          try {
            recentProjects = await readWorkspaceTaskList(workspaceDir);
          } catch (error) {
            notifyError(error, { title: 'Не удалось прочитать рабочую папку' });
            recentProjects = [];
          }
        }
        recentProjects = withoutHiddenTaskFiles(recentProjects, hiddenTaskFilePaths);

        set({
          settings,
          recentProjects,
          hiddenTaskFilePaths,
          isInitialized: true,
          isLoading: false,
        });
      } catch (error) {
        notifyError(error, { title: 'Ошибка инициализации' });
        set({
          settings: DEFAULT_APP_SETTINGS,
          recentProjects: [],
          hiddenTaskFilePaths: [],
          isInitialized: true,
          isLoading: false,
        });
      }
    })();

    ongoingInitialize = run;
    void run.finally(() => {
      if (ongoingInitialize === run) {
        ongoingInitialize = null;
      }
    });
    return run;
  },

  setSettings: async (settings) => {
    set({ settings });

    try {
      if (appStorageService.isAvailable()) {
        await appStorageService.saveSettings(settings);
      }
    } catch (error) {
      notifyError(error, { title: 'Не удалось сохранить настройки' });
    }
  },

  updateSettings: async (partial) => {
    const next: AppSettings = {
      ...get().settings,
      ...partial,
      autosave: {
        ...get().settings.autosave,
        ...partial.autosave,
      },
      storage: {
        ...get().settings.storage,
        ...partial.storage,
      },
      export: {
        ...get().settings.export,
        ...partial.export,
      },
      hotkeys: {
        ...get().settings.hotkeys,
        ...partial.hotkeys,
      },
    };

    await get().setSettings(next);
  },

  setRecentProjects: (projects) => {
    set({ recentProjects: projects });
  },

  refreshRecentProjects: async () => {
    try {
      if (!appStorageService.isAvailable()) {
        return false;
      }

      const workspaceDir = normalizeWorkspaceDirectory(get().settings.storage.defaultProjectsDirectory);
      const hiddenTaskFilePaths = get().hiddenTaskFilePaths;
      if (workspaceDir) {
        const recentProjects = withoutHiddenTaskFiles(
          await readWorkspaceTaskList(workspaceDir),
          hiddenTaskFilePaths,
        );
        if (
          normalizeWorkspaceDirectory(get().settings.storage.defaultProjectsDirectory) !== workspaceDir
        ) {
          return false;
        }
        set({ recentProjects });
        return true;
      }

      const recentProjects = withoutHiddenTaskFiles(
        await appStorageService.getRecentProjects(),
        hiddenTaskFilePaths,
      );
      set({ recentProjects });
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить список задач' });
      if (normalizeWorkspaceDirectory(get().settings.storage.defaultProjectsDirectory)) {
        set({ recentProjects: [] });
      }
      return false;
    }
  },

  hideTaskFile: async (filePath) => {
    const hiddenTaskFilePaths = appStorageService.isAvailable()
      ? await appStorageService.hideTaskFilePath(filePath)
      : [...get().hiddenTaskFilePaths, filePath];
    set({
      hiddenTaskFilePaths,
      recentProjects: withoutHiddenTaskFiles(get().recentProjects, hiddenTaskFilePaths),
    });
    if (!normalizeWorkspaceDirectory(get().settings.storage.defaultProjectsDirectory)) {
      if (appStorageService.isAvailable()) {
        await appStorageService.saveRecentProjects(get().recentProjects);
      }
    }
    if (appStorageService.isAvailable()) {
      const lastPath = await appStorageService.getLastOpenedProjectPath();
      if (lastPath && isHiddenTaskFile(lastPath, hiddenTaskFilePaths)) {
        await appStorageService.setLastOpenedProjectPath(null);
      }
    }
  },

  revealTaskFile: async (filePath) => {
    const hiddenTaskFilePaths = appStorageService.isAvailable()
      ? await appStorageService.revealTaskFilePath(filePath)
      : get().hiddenTaskFilePaths.filter((item) => item !== filePath);
    set({ hiddenTaskFilePaths });
  },
}));
