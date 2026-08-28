import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { confirmAction } from '@/application/ui/confirmAction';
import { DEFAULT_APP_SETTINGS, type AppSettings, type HotkeySettings } from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { isValidHotkey } from '@/utils/hotkeys';
import { useAppStore } from '@/stores/useAppStore';

export const settingsActions = {
  async pickDefaultDirectory(): Promise<string | null> {
    try {
      const api = window.electronAPI;
      if (!api?.dialog?.openFile) {
        throw new AppError(
          'IPC_UNAVAILABLE',
          'Выбор папки доступен только в Electron. Запустите приложение через npm run dev.',
        );
      }

      const current = useAppStore.getState().settings.storage.defaultProjectsDirectory;
      const selected = await api.dialog.openFile({
        title: 'Папка задач по умолчанию',
        defaultPath: current ?? undefined,
        properties: ['openDirectory'],
      });

      if (!selected) {
        return null;
      }

      await useAppStore.getState().updateSettings({
        storage: {
          ...useAppStore.getState().settings.storage,
          defaultProjectsDirectory: selected,
        },
      });

      notifySuccess('Папка по умолчанию обновлена');
      return selected;
    } catch (error) {
      notifyError(error, { title: 'Не удалось выбрать папку' });
      return null;
    }
  },

  async clearDefaultDirectory(): Promise<void> {
    await useAppStore.getState().updateSettings({
      storage: {
        ...useAppStore.getState().settings.storage,
        defaultProjectsDirectory: null,
      },
    });
    notifySuccess('Папка по умолчанию сброшена');
  },

  async updateAutosave(partial: Partial<AppSettings['autosave']>): Promise<void> {
    const settings = useAppStore.getState().settings;
    await useAppStore.getState().updateSettings({
      autosave: {
        ...settings.autosave,
        ...partial,
      },
    });
  },

  async updateStorage(partial: Partial<AppSettings['storage']>): Promise<void> {
    const settings = useAppStore.getState().settings;
    const nextStorage = {
      ...settings.storage,
      ...partial,
    };

    await useAppStore.getState().updateSettings({ storage: nextStorage });

    if (partial.rememberLastProject === false && appStorageService.isAvailable()) {
      await appStorageService.setLastOpenedProjectPath(null);
    }
  },

  async updateExport(partial: Partial<AppSettings['export']>): Promise<void> {
    const settings = useAppStore.getState().settings;
    await useAppStore.getState().updateSettings({
      export: {
        ...settings.export,
        ...partial,
      },
    });
  },

  async updateHotkeys(partial: Partial<HotkeySettings>): Promise<boolean> {
    for (const value of Object.values(partial)) {
      if (typeof value === 'string' && !isValidHotkey(value)) {
        notifyError(new AppError('VALIDATION', `Некорректная комбинация: «${value}»`), {
          title: 'Горячие клавиши',
        });
        return false;
      }
    }

    const settings = useAppStore.getState().settings;
    await useAppStore.getState().updateSettings({
      hotkeys: {
        ...settings.hotkeys,
        ...partial,
      },
    });
    return true;
  },

  async updateLocale(locale: AppSettings['locale']): Promise<void> {
    await useAppStore.getState().updateSettings({ locale });
  },

  async resetAll(): Promise<boolean> {
    const confirmed = await confirmAction({
      title: 'Сбросить все настройки?',
      message: 'Будут восстановлены значения по умолчанию. Список недавних задач не очищается.',
      confirmLabel: 'Сбросить',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return false;
    }

    await useAppStore.getState().setSettings({ ...DEFAULT_APP_SETTINGS });
    notifySuccess('Настройки сброшены');
    return true;
  },

  async clearRecentTasks(): Promise<boolean> {
    const confirmed = await confirmAction({
      title: 'Очистить недавние задачи?',
      message: 'Список последних открытых задач будет удалён. Сами файлы не затрагиваются.',
      confirmLabel: 'Очистить',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return false;
    }

    try {
      if (appStorageService.isAvailable()) {
        await appStorageService.saveRecentProjects([]);
        await appStorageService.setLastOpenedProjectPath(null);
      }
      useAppStore.getState().setRecentProjects([]);
      notifySuccess('Список недавних задач очищен');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось очистить список' });
      return false;
    }
  },
};
