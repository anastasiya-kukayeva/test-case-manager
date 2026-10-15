import { AppError } from '@/application/errors/AppError';
import {
  isDirectoryRole,
  type DirectoryApplication,
  type DirectoryEnvironment,
  type DirectoryModule,
  type DirectoryPerson,
} from '@/domain/types';
import { joinFsPath } from '@/infrastructure/workspace/paths';

const DATA_DIR = '.tcm';
const DATA_FILE = 'directory.json';

export type WorkspaceDirectoryBundle = {
  people: DirectoryPerson[];
  applications: DirectoryApplication[];
  modules: DirectoryModule[];
  environments: DirectoryEnvironment[];
  applicationsSeeded: boolean;
};

const cache = new Map<string, WorkspaceDirectoryBundle>();
const inflight = new Map<string, Promise<WorkspaceDirectoryBundle>>();

function cacheKey(directory: string): string {
  return directory.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function requireFileApi() {
  const api = window.electronAPI;
  if (!api?.file) {
    throw new AppError(
      'IPC_UNAVAILABLE',
      'Чтение рабочей папки доступно только в Electron. Запустите приложение через npm run dev.',
    );
  }
  return api;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePeople(value: unknown): DirectoryPerson[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const people: DirectoryPerson[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isDirectoryRole(item.role)) {
      continue;
    }
    const id = asText(item.id);
    const name = asText(item.name);
    if (!id || !name) {
      continue;
    }
    people.push({
      id,
      name,
      role: item.role,
      createdAt: asText(item.createdAt) || new Date().toISOString(),
      isDefault: item.role === 'author' && item.isDefault === true,
    });
  }

  return people.sort((a, b) => {
    const byRole = a.role.localeCompare(b.role);
    if (byRole !== 0) {
      return byRole;
    }
    return a.name.localeCompare(b.name, 'ru');
  });
}

function parseNamed(value: unknown): Array<{ id: string; name: string; createdAt: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: asText(item.id),
      name: asText(item.name),
      createdAt: asText(item.createdAt) || new Date().toISOString(),
    }))
    .filter((item) => item.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function parseEnvironments(value: unknown): DirectoryEnvironment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: asText(item.id),
      name: asText(item.name),
      createdAt: asText(item.createdAt) || new Date().toISOString(),
      isDefault: item.isDefault === true,
    }))
    .filter((item) => item.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function parseWorkspaceDirectory(content: string): WorkspaceDirectoryBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new AppError('STORAGE_READ', 'Файл справочников рабочей папки повреждён', {
      cause: error,
    });
  }

  const record = isRecord(parsed) ? parsed : {};
  return {
    people: parsePeople(record.people),
    applications: parseNamed(record.applications),
    modules: parseNamed(record.modules),
    environments: parseEnvironments(record.environments),
    applicationsSeeded: record.applicationsSeeded === true,
  };
}

function directoryFilePath(directory: string): string {
  return joinFsPath(directory, DATA_DIR, DATA_FILE);
}

async function writeBundle(directory: string, bundle: WorkspaceDirectoryBundle): Promise<void> {
  const api = requireFileApi();
  const payload = `${JSON.stringify(bundle, null, 2)}\n`;
  try {
    await api.file.write(directoryFilePath(directory), payload);
  } catch (error) {
    throw new AppError('STORAGE_WRITE', 'Не удалось сохранить справочники в рабочую папку', {
      cause: error,
    });
  }
}

async function loadBundle(
  directory: string,
  seed: () => Promise<WorkspaceDirectoryBundle>,
): Promise<WorkspaceDirectoryBundle> {
  const api = requireFileApi();
  const folderExists = await api.file.exists(directory);
  if (!folderExists) {
    throw new AppError('NOT_FOUND', `Рабочая папка не найдена:\n${directory}`);
  }

  const filePath = directoryFilePath(directory);
  const fileExists = await api.file.exists(filePath);
  if (!fileExists) {
    const seeded = await seed();
    await writeBundle(directory, seeded);
    return seeded;
  }

  try {
    const { content } = await api.file.read(filePath);
    return parseWorkspaceDirectory(content);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('STORAGE_READ', 'Не удалось прочитать справочники рабочей папки', {
      cause: error,
    });
  }
}

export function invalidateWorkspaceDirectoryCache(): void {
  cache.clear();
  inflight.clear();
}

export async function readWorkspaceDirectoryBundle(
  directory: string,
  seed: () => Promise<WorkspaceDirectoryBundle>,
): Promise<WorkspaceDirectoryBundle> {
  const key = cacheKey(directory);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const promise = loadBundle(directory, seed)
    .then((bundle) => {
      cache.set(key, bundle);
      inflight.delete(key);
      return bundle;
    })
    .catch((error: unknown) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

export async function updateWorkspaceDirectoryBundle(
  directory: string,
  updater: (current: WorkspaceDirectoryBundle) => WorkspaceDirectoryBundle,
  seed: () => Promise<WorkspaceDirectoryBundle>,
): Promise<WorkspaceDirectoryBundle> {
  const current = await readWorkspaceDirectoryBundle(directory, seed);
  const next = updater(current);
  await writeBundle(directory, next);
  cache.set(cacheKey(directory), next);
  return next;
}
