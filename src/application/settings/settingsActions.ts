import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { confirmAction } from '@/application/ui/confirmAction';
import { reloadWorkspaceBoundData } from '@/application/workspace/workspaceActions';
import { DEFAULT_APP_SETTINGS, type AppSettings, type HotkeySettings } from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { normalizeWorkspaceDirectory } from '@/infrastructure/workspace/paths';
import { useAppStore } from '@/stores/useAppStore';
import { isValidHotkey } from '@/utils/hotkeys';

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
        title: 'Рабочая папка',
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

      const loaded = await reloadWorkspaceBoundData();
      if (loaded) {
        notifySuccess('Рабочая папка обновлена. Данные загружены из неё.');
      }
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
    await reloadWorkspaceBoundData();
    notifySuccess('Рабочая папка сброшена');
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
    await reloadWorkspaceBoundData();
    notifySuccess('Настройки сброшены');
    return true;
  },

  async clearRecentTasks(): Promise<boolean> {
    const workspaceDir = normalizeWorkspaceDirectory(
      useAppStore.getState().settings.storage.defaultProjectsDirectory,
    );
    const confirmed = await confirmAction({
      title: workspaceDir ? 'Очистить историю открытий?' : 'Очистить недавние задачи?',
      message: workspaceDir
        ? 'История последних открытий будет очищена. Список задач по-прежнему загружается из рабочей папки. Файлы не удаляются.'
        : 'Список последних открытых задач будет удалён. Сами файлы не затрагиваются.',
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
      if (workspaceDir) {
        await useAppStore.getState().refreshRecentProjects();
        notifySuccess('История открытий очищена. Задачи из рабочей папки остались в списке.');
      } else {
        useAppStore.getState().setRecentProjects([]);
        notifySuccess('Список недавних задач очищен');
      }
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось очистить список' });
      return false;
    }
  },
};
