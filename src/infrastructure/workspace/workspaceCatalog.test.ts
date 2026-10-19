import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '@/application/errors/AppError';
import type { ElectronApi } from '@/vite-env';
import {
  readWorkspaceTaskList,
  upsertWorkspaceTask,
} from '@/infrastructure/workspace/workspaceCatalog';
import type { RecentProject } from '@/domain/types';

function recent(name: string, filePath: string): RecentProject {
  return {
    id: filePath,
    name,
    filePath,
    openedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('upsertWorkspaceTask', () => {
  it('inserts or updates a task and sorts by Russian name', () => {
    const initial = [recent('Яблоко', 'D:\\c.tctask')];
    const withBeta = upsertWorkspaceTask(initial, recent('Бета', 'D:\\b.tctask'));
    const updated = upsertWorkspaceTask(withBeta, {
      ...recent('Альфа', 'D:\\b.tctask'),
      id: 'new',
    });

    expect(updated.map((item) => item.name)).toEqual(['Альфа', 'Яблоко']);
    expect(updated[0]?.id).toBe('new');
    expect(updated[0]?.filePath).toBe('D:\\b.tctask');
  });
});

describe('readWorkspaceTaskList', () => {
  afterEach(() => {
    delete window.electronAPI;
  });

  it('asks for Electron when the file bridge is missing', async () => {
    await expect(readWorkspaceTaskList('D:\\tasks')).rejects.toBeInstanceOf(AppError);
    await expect(readWorkspaceTaskList('D:\\tasks')).rejects.toMatchObject({
      code: 'IPC_UNAVAILABLE',
    });
  });

  it('sorts tasks and disambiguates duplicate ids', async () => {
    window.electronAPI = {
      file: {
        listTasks: async () => [
          {
            filePath: 'D:/work/b.tctask',
            id: 'same',
            name: 'Бета',
            shortName: '   ',
            parentTaskId: null,
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
          {
            filePath: 'D:/work/a.tctask',
            id: 'same',
            name: 'Альфа',
            shortName: 'А',
            parentTaskId: 'parent-1',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    } as unknown as ElectronApi;

    const tasks = await readWorkspaceTaskList('D:\\work');

    expect(tasks.map((item) => item.name)).toEqual(['Альфа', 'Бета']);
    expect(tasks[0]).toMatchObject({
      id: 'same::D:/work/a.tctask',
      shortName: 'А',
      parentTaskId: 'parent-1',
    });
    expect(tasks[1]).toMatchObject({
      id: 'same',
      shortName: undefined,
      parentTaskId: null,
    });
  });
});
