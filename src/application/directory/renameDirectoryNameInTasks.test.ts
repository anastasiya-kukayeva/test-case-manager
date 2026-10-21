import { afterEach, describe, expect, it } from 'vitest';
import { renameDirectoryNameInTasks } from '@/application/directory/renameDirectoryNameInTasks';
import { createEmptyTaskDocument, createEmptyTestCase } from '@/domain/factories/createEntities';
import type { TaskDocument } from '@/domain/types';
import { parseTaskFileContent, serializeTaskDocument } from '@/infrastructure/project/tcprojFormat';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';
import type { ElectronApi } from '@/vite-env';

function document(fields: { name: string; application: string; module: string }): TaskDocument {
  return createEmptyTaskDocument({
    meta: fields,
    testCases: [createEmptyTestCase({ title: 'Кейс', module: fields.module })],
  });
}

describe('renameDirectoryNameInTasks', () => {
  const files = new Map<string, string>();

  afterEach(() => {
    files.clear();
    useProjectStore.setState({ current: null });
    useAppStore.setState({ recentProjects: [] });
    delete window.electronAPI;
  });

  it('writes the new module into the open task and other task files', async () => {
    files.set(
      'D:/tasks/open.tctask',
      serializeTaskDocument(
        document({
          name: 'Открытая',
          application: 'Касса',
          module: '1. Оплата',
        }),
      ),
    );
    files.set(
      'D:/tasks/other.tctask',
      serializeTaskDocument(
        document({
          name: 'Другая',
          application: 'Касса',
          module: '1. оплата',
        }),
      ),
    );
    files.set(
      'D:/tasks/keep.tctask',
      serializeTaskDocument(
        document({
          name: 'Чужая',
          application: 'Склад',
          module: '2. Остатки',
        }),
      ),
    );
    const kept = files.get('D:/tasks/keep.tctask');

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

    const openDocument = parseTaskFileContent(files.get('D:/tasks/open.tctask') ?? '');
    useProjectStore.setState({
      current: {
        document: { ...openDocument, meta: { ...openDocument.meta, releaseNumber: 'черновик' } },
        filePath: 'D:/tasks/open.tctask',
        isDirty: true,
        lastSavedAt: null,
      },
    });
    useAppStore.setState({
      recentProjects: [
        {
          id: 'open',
          name: 'Открытая',
          filePath: 'D:/tasks/open.tctask',
          openedAt: '2026-10-21T00:00:00.000Z',
        },
        {
          id: 'other',
          name: 'Другая',
          filePath: 'D:/tasks/other.tctask',
          openedAt: '2026-10-21T00:00:00.000Z',
        },
        {
          id: 'keep',
          name: 'Чужая',
          filePath: 'D:/tasks/keep.tctask',
          openedAt: '2026-10-21T00:00:00.000Z',
        },
      ],
    });

    await renameDirectoryNameInTasks('module', '1. Оплата', '1. Оплаты');

    const open = useProjectStore.getState().current;
    expect(open?.document.meta.module).toBe('1. Оплаты');
    expect(open?.document.meta.releaseNumber).toBe('черновик');
    expect(open?.document.testCases[0]?.module).toBe('1. Оплата');
    expect(open?.isDirty).toBe(false);

    const other = parseTaskFileContent(files.get('D:/tasks/other.tctask') ?? '');
    expect(other.meta.module).toBe('1. Оплаты');
    expect(other.meta.application).toBe('Касса');
    expect(other.testCases[0]?.module).toBe('1. оплата');
    expect(files.get('D:/tasks/keep.tctask')).toBe(kept);
  });
});
