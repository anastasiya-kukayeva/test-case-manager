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
import { compareModuleNames } from '@/domain/utils/moduleOrder';
import { StorageKeys } from '@/infrastructure/storage/storageKeys';
import { normalizeWorkspaceDirectory } from '@/infrastructure/workspace/paths';
import {
  invalidateWorkspaceDirectoryCache,
  readWorkspaceDirectoryBundle,
  updateWorkspaceDirectoryBundle,
  type WorkspaceDirectoryBundle,
} from '@/infrastructure/workspace/workspaceDirectory';

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

const mirroredWorkspaceDirs = new Set<string>();

export function invalidateWorkspaceBinding(): void {
  invalidateWorkspaceDirectoryCache();
  mirroredWorkspaceDirs.clear();
}

async function getWorkspaceDirectory(): Promise<string | null> {
  const settings = await storeGet<Partial<AppSettings>>(StorageKeys.SETTINGS);
  return normalizeWorkspaceDirectory(settings?.storage?.defaultProjectsDirectory);
}

async function readDirectoryPeopleFromStore(): Promise<DirectoryPerson[]> {
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
    const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();

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
}

async function readDirectoryApplicationsFromStore(): Promise<DirectoryApplication[]> {
  const items = await storeGet<Array<Partial<DirectoryApplication>>>(StorageKeys.DIRECTORY_APPLICATIONS);
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
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

async function readDirectoryModulesFromStore(): Promise<DirectoryModule[]> {
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
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    }))
    .sort((a, b) => compareModuleNames(a.name, b.name));
}

async function readDirectoryEnvironmentsFromStore(): Promise<DirectoryEnvironment[]> {
  const items = await storeGet<Array<Partial<DirectoryEnvironment>>>(StorageKeys.DIRECTORY_ENVIRONMENTS);
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
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      isDefault: item.isDefault === true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

async function readDirectoryApplicationsSeededFromStore(): Promise<boolean> {
  return Boolean(await storeGet<boolean>(StorageKeys.DIRECTORY_APPLICATIONS_SEEDED));
}

async function readStoreDirectoryBundle(): Promise<WorkspaceDirectoryBundle> {
  const [people, applications, modules, environments, applicationsSeeded] = await Promise.all([
    readDirectoryPeopleFromStore(),
    readDirectoryApplicationsFromStore(),
    readDirectoryModulesFromStore(),
    readDirectoryEnvironmentsFromStore(),
    readDirectoryApplicationsSeededFromStore(),
  ]);

  return { people, applications, modules, environments, applicationsSeeded };
}

async function mirrorBundleToStore(bundle: WorkspaceDirectoryBundle): Promise<void> {
  await Promise.all([
    storeSet(StorageKeys.DIRECTORY_PEOPLE, bundle.people),
    storeSet(StorageKeys.DIRECTORY_APPLICATIONS, bundle.applications),
    storeSet(StorageKeys.DIRECTORY_MODULES, bundle.modules),
    storeSet(StorageKeys.DIRECTORY_ENVIRONMENTS, bundle.environments),
    storeSet(StorageKeys.DIRECTORY_APPLICATIONS_SEEDED, bundle.applicationsSeeded),
  ]);
}

async function ensureWorkspaceBundle(directory: string): Promise<WorkspaceDirectoryBundle> {
  const bundle = await readWorkspaceDirectoryBundle(directory, readStoreDirectoryBundle);
  const key = directory.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  if (!mirroredWorkspaceDirs.has(key)) {
    await mirrorBundleToStore(bundle);
    mirroredWorkspaceDirs.add(key);
  }
  return bundle;
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
      next = [{ ...(existing ?? {}), ...project }, ...filtered];
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
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      return (await ensureWorkspaceBundle(workspace)).people;
    }
    return readDirectoryPeopleFromStore();
  },

  async saveDirectoryPeople(people: DirectoryPerson[]): Promise<void> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      await updateWorkspaceDirectoryBundle(
        workspace,
        (current) => ({ ...current, people }),
        readStoreDirectoryBundle,
      );
    }
    await storeSet(StorageKeys.DIRECTORY_PEOPLE, people);
  },

  async getDirectoryApplications(): Promise<DirectoryApplication[]> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      return (await ensureWorkspaceBundle(workspace)).applications;
    }
    return readDirectoryApplicationsFromStore();
  },

  async saveDirectoryApplications(applications: DirectoryApplication[]): Promise<void> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      await updateWorkspaceDirectoryBundle(
        workspace,
        (current) => ({ ...current, applications }),
        readStoreDirectoryBundle,
      );
    }
    await storeSet(StorageKeys.DIRECTORY_APPLICATIONS, applications);
  },

  async getDirectoryModules(): Promise<DirectoryModule[]> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      return (await ensureWorkspaceBundle(workspace)).modules;
    }
    return readDirectoryModulesFromStore();
  },

  async saveDirectoryModules(modules: DirectoryModule[]): Promise<void> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      await updateWorkspaceDirectoryBundle(
        workspace,
        (current) => ({ ...current, modules }),
        readStoreDirectoryBundle,
      );
    }
    await storeSet(StorageKeys.DIRECTORY_MODULES, modules);
  },

  async getDirectoryEnvironments(): Promise<DirectoryEnvironment[]> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      return (await ensureWorkspaceBundle(workspace)).environments;
    }
    return readDirectoryEnvironmentsFromStore();
  },

  async saveDirectoryEnvironments(environments: DirectoryEnvironment[]): Promise<void> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      await updateWorkspaceDirectoryBundle(
        workspace,
        (current) => ({ ...current, environments }),
        readStoreDirectoryBundle,
      );
    }
    await storeSet(StorageKeys.DIRECTORY_ENVIRONMENTS, environments);
  },

  async isDirectoryApplicationsSeeded(): Promise<boolean> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      return (await ensureWorkspaceBundle(workspace)).applicationsSeeded;
    }
    return readDirectoryApplicationsSeededFromStore();
  },

  async markDirectoryApplicationsSeeded(): Promise<void> {
    const workspace = await getWorkspaceDirectory();
    if (workspace) {
      await updateWorkspaceDirectoryBundle(
        workspace,
        (current) => ({ ...current, applicationsSeeded: true }),
        readStoreDirectoryBundle,
      );
    }
    await storeSet(StorageKeys.DIRECTORY_APPLICATIONS_SEEDED, true);
  },

  isAvailable(): boolean {
    return Boolean(getElectronApi()?.store);
  },
};
