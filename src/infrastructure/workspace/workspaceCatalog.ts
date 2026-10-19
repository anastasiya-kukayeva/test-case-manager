import { AppError } from '@/application/errors/AppError';
import type { RecentProject } from '@/domain/types';

function uniqueTaskId(id: string, filePath: string, seen: Set<string>): string {
  if (!seen.has(id)) {
    seen.add(id);
    return id;
  }
  const disambiguated = `${id}::${filePath}`;
  seen.add(disambiguated);
  return disambiguated;
}

export async function readWorkspaceTaskList(directory: string): Promise<RecentProject[]> {
  const api = window.electronAPI;
  if (!api?.file?.listTasks) {
    throw new AppError(
      'IPC_UNAVAILABLE',
      'Чтение рабочей папки доступно только в Electron. Запустите приложение через npm run dev.',
    );
  }

  try {
    const items = await api.file.listTasks(directory);
    const seenIds = new Set<string>();
    return items
      .map((item) => ({
        id: uniqueTaskId(item.id, item.filePath, seenIds),
        name: item.name,
        shortName: item.shortName.trim() || undefined,
        filePath: item.filePath,
        openedAt: item.updatedAt || new Date(0).toISOString(),
        parentTaskId: item.parentTaskId,
      }))
      .sort(
        (a, b) => a.name.localeCompare(b.name, 'ru') || a.filePath.localeCompare(b.filePath, 'ru'),
      );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Не удалось прочитать рабочую папку';
    throw new AppError('STORAGE_READ', message, { cause: error });
  }
}

export function upsertWorkspaceTask(
  tasks: RecentProject[],
  project: RecentProject,
): RecentProject[] {
  const index = tasks.findIndex((item) => item.filePath === project.filePath);
  const next = tasks.slice();
  if (index >= 0) {
    next[index] = { ...next[index], ...project, filePath: project.filePath };
  } else {
    next.push(project);
  }
  return next.sort(
    (a, b) => a.name.localeCompare(b.name, 'ru') || a.filePath.localeCompare(b.filePath, 'ru'),
  );
}
