import { beforeEach, describe, expect, it } from 'vitest';
import { listCopyTargetTasks, copyTargetLabel } from '@/application/testCases/listCopyTargetTasks';
import { createEmptyTaskDocument } from '@/domain/factories/createEntities';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

describe('listCopyTargetTasks', () => {
  beforeEach(() => {
    useProjectStore.setState({ current: null });
    useAppStore.setState({ recentProjects: [] });
  });

  it('puts the open task first and skips its file in the recent list', () => {
    useProjectStore.setState({
      current: {
        document: createEmptyTaskDocument({
          meta: { id: 'open', name: 'Открытая задача', shortName: 'Открытая' },
        }),
        filePath: 'C:/tasks/open.tctask',
        isDirty: false,
        lastSavedAt: null,
      },
    });
    useAppStore.setState({
      recentProjects: [
        {
          id: 'open',
          name: 'Открытая задача',
          shortName: 'Открытая',
          filePath: 'C:/tasks/open.tctask',
          openedAt: '2026-10-20T00:00:00.000Z',
        },
        {
          id: 'other',
          name: 'Полное имя второй',
          shortName: 'Вторая',
          filePath: 'C:/tasks/other.tctask',
          openedAt: '2026-10-19T00:00:00.000Z',
        },
        {
          id: 'unsaved',
          name: 'Черновик',
          filePath: '__unsaved__draft',
          openedAt: '2026-10-18T00:00:00.000Z',
        },
      ],
    });

    const tasks = listCopyTargetTasks();

    expect(tasks.map((task) => task.taskId)).toEqual(['open', 'other']);
    expect(tasks[0]?.current).toBe(true);
    expect(tasks[1]?.current).toBe(false);
    expect(copyTargetLabel(tasks[0]!)).toBe('Открытая — Открытая задача (текущая)');
    expect(copyTargetLabel(tasks[1]!)).toBe('Вторая — Полное имя второй');
  });

  it('keeps an unsaved open task selectable', () => {
    useProjectStore.setState({
      current: {
        document: createEmptyTaskDocument({
          meta: { id: 'draft', name: 'Новая задача', shortName: 'Новая' },
        }),
        filePath: null,
        isDirty: true,
        lastSavedAt: null,
      },
    });

    const tasks = listCopyTargetTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ current: true, filePath: null, taskId: 'draft' });
  });
});
