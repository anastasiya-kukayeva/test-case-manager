import { afterEach, describe, expect, it } from 'vitest';
import { separateDuplicateTaskFiles } from '@/application/project/separateDuplicateTaskFiles';
import { createEmptyTaskDocument } from '@/domain/factories/createEntities';
import type { TaskDocument } from '@/domain/types';
import { parseTaskFileContent, serializeTaskDocument } from '@/infrastructure/project/tcprojFormat';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';
import type { ElectronApi } from '@/vite-env';

function taskDocument(id: string, name: string, shortName: string): TaskDocument {
  return createEmptyTaskDocument({ meta: { id, name, shortName } });
}

describe('separateDuplicateTaskFiles', () => {
  const files = new Map<string, string>();

  afterEach(() => {
    files.clear();
    useProjectStore.setState({ current: null });
    useAppStore.setState({ recentProjects: [] });
    delete window.electronAPI;
  });

  function stubFiles(): void {
    window.electronAPI = {
      file: {
        exists: async (filePath: string) => files.has(filePath),
        read: async (filePath: string) => ({ content: files.get(filePath) ?? '' }),
        write: async (filePath: string, content: string) => {
          files.set(filePath, content);
        },
      },
      dialog: {},
      app: {},
    } as unknown as ElectronApi;
  }

  it('keeps the copy title and gives the copied file its own id', async () => {
    files.set(
      'D:/tasks/source.tctask',
      serializeTaskDocument(taskDocument('same', 'Исходная', 'И')),
    );
    files.set('D:/tasks/copy.tctask', serializeTaskDocument(taskDocument('same', 'Копия', 'К')));
    stubFiles();
    useAppStore.setState({
      recentProjects: [
        {
          id: 'same',
          name: 'Исходная',
          shortName: 'И',
          filePath: 'D:/tasks/source.tctask',
          openedAt: '2026-10-23T00:00:00.000Z',
        },
        {
          id: 'same::D:/tasks/copy.tctask',
          name: 'Копия',
          shortName: 'К',
          filePath: 'D:/tasks/copy.tctask',
          openedAt: '2026-10-23T00:00:00.000Z',
        },
      ],
    });

    await separateDuplicateTaskFiles();

    const source = parseTaskFileContent(files.get('D:/tasks/source.tctask') ?? '');
    const copy = parseTaskFileContent(files.get('D:/tasks/copy.tctask') ?? '');
    expect(source.meta.id).toBe('same');
    expect(source.meta.name).toBe('Исходная');
    expect(copy.meta.id).not.toBe('same');
    expect(copy.meta.name).toBe('Копия');
    expect(copy.meta.shortName).toBe('К');

    const listed = useAppStore.getState().recentProjects;
    expect(listed.find((item) => item.filePath.endsWith('copy.tctask'))).toMatchObject({
      id: copy.meta.id,
      name: 'Копия',
      shortName: 'К',
    });
    expect(listed.find((item) => item.filePath.endsWith('source.tctask'))?.id).toBe('same');
  });

  it('does not write over an unsaved rename of the open copy', async () => {
    files.set(
      'D:/tasks/source.tctask',
      serializeTaskDocument(taskDocument('same', 'Исходная', 'И')),
    );
    files.set('D:/tasks/copy.tctask', serializeTaskDocument(taskDocument('same', 'Копия', 'К')));
    stubFiles();
    const openCopy = taskDocument('same', 'Новое имя', 'НК');
    useProjectStore.setState({
      current: {
        document: openCopy,
        filePath: 'D:/tasks/copy.tctask',
        isDirty: true,
        lastSavedAt: null,
      },
    });
    useAppStore.setState({
      recentProjects: [
        {
          id: 'same',
          name: 'Исходная',
          shortName: 'И',
          filePath: 'D:/tasks/source.tctask',
          openedAt: '2026-10-23T00:00:00.000Z',
        },
        {
          id: 'same::D:/tasks/copy.tctask',
          name: 'Копия',
          shortName: 'К',
          filePath: 'D:/tasks/copy.tctask',
          openedAt: '2026-10-23T00:00:00.000Z',
        },
      ],
    });

    await separateDuplicateTaskFiles();

    const disk = parseTaskFileContent(files.get('D:/tasks/copy.tctask') ?? '');
    expect(disk.meta.name).toBe('Копия');
    const current = useProjectStore.getState().current;
    expect(current?.document.meta.name).toBe('Новое имя');
    expect(current?.document.meta.shortName).toBe('НК');
    expect(current?.document.meta.id).not.toBe('same');
    expect(current?.isDirty).toBe(true);
  });
});
