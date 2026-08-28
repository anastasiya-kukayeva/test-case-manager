import { create } from 'zustand';
import { notifyError } from '@/application/errors/errorHandler';
import { DEFAULT_APP_SETTINGS, type AppSettings, type RecentProject } from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';

type AppStoreState = {
  settings: AppSettings;
  recentProjects: RecentProject[];
  isInitialized: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  setSettings: (settings: AppSettings) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setRecentProjects: (projects: RecentProject[]) => void;
  refreshRecentProjects: () => Promise<void>;
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  recentProjects: [],
  isInitialized: false,
  isLoading: false,

  initialize: async () => {
    if (get().isInitialized || get().isLoading) {
      return;
    }

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

      const [settings, recentProjects] = await Promise.all([
        appStorageService.getSettings(),
        appStorageService.getRecentProjects(),
      ]);

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
        return;
      }

      const recentProjects = await appStorageService.getRecentProjects();
      set({ recentProjects });
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить список задач' });
    }
  },
}));
