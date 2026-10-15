import { create } from 'zustand';
import { notifyError } from '@/application/errors/errorHandler';
import { DEFAULT_APP_SETTINGS, type AppSettings, type RecentProject } from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { normalizeWorkspaceDirectory } from '@/infrastructure/workspace/paths';
import { readWorkspaceTaskList } from '@/infrastructure/workspace/workspaceCatalog';

type AppStoreState = {
  settings: AppSettings;
  recentProjects: RecentProject[];
  isInitialized: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  setSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setRecentProjects: (projects: RecentProject[]) => void;
  refreshRecentProjects: () => Promise<boolean>;
};

let ongoingInitialize: Promise<void> | null = null;

export const useAppStore = create<AppStoreState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  recentProjects: [],
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
            isInitialized: true,
            isLoading: false,
          });
          return;
        }

        const [settings, storedRecent] = await Promise.all([
          appStorageService.getSettings(),
          appStorageService.getRecentProjects(),
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

        set({
          settings,
          recentProjects,
          isInitialized: true,
          isLoading: false,
        });
      } catch (error) {
        notifyError(error, { title: 'Ошибка инициализации' });
        set({
          settings: DEFAULT_APP_SETTINGS,
          recentProjects: [],
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
      if (workspaceDir) {
        const recentProjects = await readWorkspaceTaskList(workspaceDir);
        if (
          normalizeWorkspaceDirectory(get().settings.storage.defaultProjectsDirectory) !== workspaceDir
        ) {
          return false;
        }
        set({ recentProjects });
        return true;
      }

      const recentProjects = await appStorageService.getRecentProjects();
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
}));
