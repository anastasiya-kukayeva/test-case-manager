import { nanoid } from 'nanoid';
import { AppError } from '@/application/errors/AppError';
import {
  DEFAULT_APP_SETTINGS,
  DIRECTORY_ROLES,
  isDirectoryRole,
  type AppSettings,
  type DirectoryApplication,
  type DirectoryEnvironment,
  type DirectoryModule,
  type DirectoryPerson,
  type RecentProject,
} from '@/domain/types';
import { StorageKeys } from '@/infrastructure/storage/storageKeys';

function getElectronApi() {
  if (typeof window === 'undefined' || !window.electronAPI?.store) {
    return null;
  }

  return window.electronAPI;
}

async function storeGet<T>(key: string): Promise<T | undefined> {
  const api = getElectronApi();

  if (!api) {
    throw new AppError('IPC_UNAVAILABLE', 'Electron Store недоступен. Запустите приложение через Electron.');
  }

  try {
    return await api.store.get<T>(key);
  } catch (error) {
    throw new AppError('STORAGE_READ', `Не удалось прочитать ключ «${key}»`, { cause: error });
  }
}

async function storeSet(key: string, value: unknown): Promise<void> {
  const api = getElectronApi();

  if (!api) {
    throw new AppError('IPC_UNAVAILABLE', 'Electron Store недоступен. Запустите приложение через Electron.');
  }

  try {
    await api.store.set(key, value);
  } catch (error) {
    throw new AppError('STORAGE_WRITE', `Не удалось сохранить ключ «${key}»`, { cause: error });
  }
}

function mergeSettings(raw: Partial<AppSettings> | undefined): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    ...raw,
    autosave: {
      ...DEFAULT_APP_SETTINGS.autosave,
      ...raw?.autosave,
    },
    storage: {
      ...DEFAULT_APP_SETTINGS.storage,
      ...raw?.storage,
    },
    export: {
      ...DEFAULT_APP_SETTINGS.export,
      ...raw?.export,
    },
    hotkeys: {
      ...DEFAULT_APP_SETTINGS.hotkeys,
      ...raw?.hotkeys,
    },
  };
}

export const appStorageService = {
  async getSettings(): Promise<AppSettings> {
    const raw = await storeGet<Partial<AppSettings>>(StorageKeys.SETTINGS);
    return mergeSettings(raw);
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    await storeSet(StorageKeys.SETTINGS, settings);
  },

  async getRecentProjects(): Promise<RecentProject[]> {
    const recent = await storeGet<RecentProject[]>(StorageKeys.RECENT_PROJECTS);
    return Array.isArray(recent) ? recent : [];
  },

  async saveRecentProjects(projects: RecentProject[]): Promise<void> {
    await storeSet(StorageKeys.RECENT_PROJECTS, projects);
  },

  async addRecentProject(
    project: RecentProject,
    limit = 10,
    options?: { bumpToFront?: boolean },
  ): Promise<RecentProject[]> {
    const bumpToFront = options?.bumpToFront ?? true;
    const current = await this.getRecentProjects();
    const existingIndex = current.findIndex((item) => item.filePath === project.filePath);

    let next: RecentProject[];
    if (existingIndex >= 0 && !bumpToFront) {
      next = current.map((item, index) => (index === existingIndex ? { ...item, ...project } : item));
    } else {
      const existing = existingIndex >= 0 ? current[existingIndex] : null;
      const filtered = current.filter((item) => item.filePath !== project.filePath);
      next = [{ ...(existing ?? {}), ...project }, ...filtered].slice(0, limit);
    }

    await this.saveRecentProjects(next);
    return next;
  },

  async getLastOpenedProjectPath(): Promise<string | null> {
    const path = await storeGet<string | null>(StorageKeys.LAST_OPENED_PROJECT_PATH);
    return path ?? null;
  },

  async setLastOpenedProjectPath(filePath: string | null): Promise<void> {
    await storeSet(StorageKeys.LAST_OPENED_PROJECT_PATH, filePath);
  },

  async getDirectoryPeople(): Promise<DirectoryPerson[]> {
    const people = await storeGet<Array<Partial<DirectoryPerson> & { id?: string; name?: string }>>(
      StorageKeys.DIRECTORY_PEOPLE,
    );
    if (!Array.isArray(people)) {
      return [];
    }

    const normalized: DirectoryPerson[] = [];
    let migrated = false;

    for (const item of people) {
      if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
        continue;
      }
      const name = item.name.trim();
      if (!name) {
        continue;
      }
      const createdAt =
        typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();

      if (isDirectoryRole(item.role)) {
        normalized.push({
          id: item.id,
          name,
          role: item.role,
          createdAt,
          isDefault: item.role === 'author' && item.isDefault === true,
        });
        continue;
      }

      // Legacy entries without role → copy into all three categories
      migrated = true;
      for (const role of DIRECTORY_ROLES) {
        normalized.push({
          id: nanoid(),
          name,
          role,
          createdAt,
        });
      }
    }

    const sorted = normalized.sort((a, b) => {
      const byRole = a.role.localeCompare(b.role);
      if (byRole !== 0) {
        return byRole;
      }
      return a.name.localeCompare(b.name, 'ru');
    });

    if (migrated) {
      await storeSet(StorageKeys.DIRECTORY_PEOPLE, sorted);
    }

    return sorted;
  },

  async saveDirectoryPeople(people: DirectoryPerson[]): Promise<void> {
    await storeSet(StorageKeys.DIRECTORY_PEOPLE, people);
  },

  async getDirectoryApplications(): Promise<DirectoryApplication[]> {
    const items = await storeGet<Array<Partial<DirectoryApplication>>>(
      StorageKeys.DIRECTORY_APPLICATIONS,
    );
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(
        (item): item is DirectoryApplication =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        createdAt:
          typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },

  async saveDirectoryApplications(applications: DirectoryApplication[]): Promise<void> {
    await storeSet(StorageKeys.DIRECTORY_APPLICATIONS, applications);
  },

  async getDirectoryModules(): Promise<DirectoryModule[]> {
    const items = await storeGet<Array<Partial<DirectoryModule>>>(StorageKeys.DIRECTORY_MODULES);
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(
        (item): item is DirectoryModule =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        createdAt:
          typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },

  async saveDirectoryModules(modules: DirectoryModule[]): Promise<void> {
    await storeSet(StorageKeys.DIRECTORY_MODULES, modules);
  },

  async getDirectoryEnvironments(): Promise<DirectoryEnvironment[]> {
    const items = await storeGet<Array<Partial<DirectoryEnvironment>>>(
      StorageKeys.DIRECTORY_ENVIRONMENTS,
    );
    if (!Array.isArray(items)) {
      return [];
    }

    return items
      .filter(
        (item): item is DirectoryEnvironment =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          item.name.trim().length > 0,
      )
      .map((item) => ({
        id: item.id,
        name: item.name.trim(),
        createdAt:
          typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
        isDefault: item.isDefault === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },

  async saveDirectoryEnvironments(environments: DirectoryEnvironment[]): Promise<void> {
    await storeSet(StorageKeys.DIRECTORY_ENVIRONMENTS, environments);
  },

  async isDirectoryApplicationsSeeded(): Promise<boolean> {
    return Boolean(await storeGet<boolean>(StorageKeys.DIRECTORY_APPLICATIONS_SEEDED));
  },

  async markDirectoryApplicationsSeeded(): Promise<void> {
    await storeSet(StorageKeys.DIRECTORY_APPLICATIONS_SEEDED, true);
  },

  isAvailable(): boolean {
    return Boolean(getElectronApi()?.store);
  },
};
