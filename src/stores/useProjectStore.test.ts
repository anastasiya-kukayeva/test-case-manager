import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyTaskDocument, createEmptyTestCase } from '@/domain/factories/createEntities';
import { DEFAULT_APP_SETTINGS, type RecentProject } from '@/domain/types';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

function recent(filePath: string, name: string): RecentProject {
  return {
    id: filePath,
    name,
    filePath,
    openedAt: '2026-03-01T00:00:00.000Z',
  };
}

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ current: null });
    useAppStore.setState({
      settings: DEFAULT_APP_SETTINGS,
      recentProjects: [],
      isInitialized: false,
      isLoading: false,
    });
  });

  it('numbers cases on add, delete and reorder', () => {
    useProjectStore.getState().createInMemoryProject('ПМИ');
    useProjectStore
      .getState()
      .addTestCase(createEmptyTestCase({ id: 'a', number: '99', title: 'А' }));
    useProjectStore
      .getState()
      .addTestCase(createEmptyTestCase({ id: 'b', number: '99', title: 'Б' }));
    useProjectStore
      .getState()
      .addTestCase(createEmptyTestCase({ id: 'c', number: '99', title: 'В' }));

    expect(
      useProjectStore.getState().current?.document.testCases.map((item) => item.number),
    ).toEqual(['1', '2', '3']);
    expect(useProjectStore.getState().current?.isDirty).toBe(true);

    useProjectStore.getState().reorderTestCases(['c', 'a']);
    expect(useProjectStore.getState().current?.document.testCases.map((item) => item.id)).toEqual([
      'c',
      'b',
      'a',
    ]);
    expect(
      useProjectStore.getState().current?.document.testCases.map((item) => item.number),
    ).toEqual(['1', '2', '3']);

    useProjectStore.getState().deleteTestCases(['b']);
    expect(
      useProjectStore.getState().current?.document.testCases.map((item) => [item.id, item.number]),
    ).toEqual([
      ['c', '1'],
      ['a', '2'],
    ]);
  });

  it('keeps the case id when the editor patch tries to replace it', () => {
    useProjectStore.getState().createInMemoryProject('ПМИ');
    useProjectStore.getState().addTestCase(createEmptyTestCase({ id: 'a', title: 'Старое' }));
    useProjectStore.getState().updateTestCase('a', { id: 'hacked', title: 'Новое' });

    const saved = useProjectStore.getState().current?.document.testCases[0];
    expect(saved?.id).toBe('a');
    expect(saved?.title).toBe('Новое');
  });

  it('ignores case changes when no task is open and clears dirty after save', () => {
    useProjectStore.getState().addTestCase(createEmptyTestCase({ id: 'a' }));
    expect(useProjectStore.getState().current).toBeNull();

    const document = createEmptyTaskDocument({
      meta: { name: 'ПМИ' },
      testCases: [createEmptyTestCase({ id: 'a', number: '1' })],
    });
    useProjectStore.getState().setCurrentDocument(document, null);
    useProjectStore.getState().reorderTestCases([]);
    expect(useProjectStore.getState().current?.isDirty).toBe(false);

    useProjectStore.getState().markDirty();
    expect(useProjectStore.getState().current?.isDirty).toBe(true);
    useProjectStore.getState().markSaved('D:\\tasks\\ПМИ.tctask');
    expect(useProjectStore.getState().current?.isDirty).toBe(false);
    expect(useProjectStore.getState().current?.filePath).toBe('D:\\tasks\\ПМИ.tctask');
    expect(useProjectStore.getState().current?.lastSavedAt).toEqual(expect.any(String));
  });

  it('remembers a task in memory and skips a file outside the workspace', async () => {
    await useProjectStore.getState().rememberRecent(recent('D:\\tasks\\a.tctask', 'Альфа'));
    await useProjectStore.getState().rememberRecent(recent('D:\\tasks\\b.tctask', 'Бета'));
    await useProjectStore.getState().rememberRecent(recent('D:\\tasks\\a.tctask', 'Альфа 2'));

    expect(useAppStore.getState().recentProjects.map((item) => item.name)).toEqual([
      'Альфа 2',
      'Бета',
    ]);

    useAppStore.setState({
      settings: {
        ...DEFAULT_APP_SETTINGS,
        storage: {
          ...DEFAULT_APP_SETTINGS.storage,
          defaultProjectsDirectory: 'D:\\workspace',
        },
      },
      recentProjects: [],
    });

    await useProjectStore.getState().rememberRecent(recent('D:\\other\\a.tctask', 'Чужая'));
    expect(useAppStore.getState().recentProjects).toEqual([]);

    await useProjectStore.getState().rememberRecent(recent('D:\\workspace\\a.tctask', 'Своя'));
    expect(useAppStore.getState().recentProjects.map((item) => item.name)).toEqual(['Своя']);
  });

  it('closes the open task', () => {
    useProjectStore.getState().createInMemoryProject('ПМИ');
    useProjectStore.getState().closeProject();
    expect(useProjectStore.getState().current).toBeNull();
  });
});
