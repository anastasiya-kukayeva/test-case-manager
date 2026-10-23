import { describe, expect, it } from 'vitest';
import {
  duplicateTaskFilesToReassign,
  overlayOpenTask,
} from '@/application/project/taskListIdentity';
import type { RecentTask } from '@/domain/types';

function task(partial: Pick<RecentTask, 'id' | 'filePath' | 'name'> & Partial<RecentTask>): RecentTask {
  return {
    shortName: '',
    openedAt: '2026-10-23T00:00:00.000Z',
    parentTaskId: null,
    ...partial,
  };
}

describe('duplicateTaskFilesToReassign', () => {
  it('gives a new id only to the copied file', () => {
    const paths = duplicateTaskFilesToReassign([
      task({ id: 'same', filePath: 'D:/tasks/source.tctask', name: 'Исходная' }),
      task({
        id: 'same::D:/tasks/copy.tctask',
        filePath: 'D:/tasks/copy.tctask',
        name: 'Копия',
      }),
    ]);

    expect(paths).toEqual(['D:/tasks/copy.tctask']);
  });

  it('leaves tasks that already have their own ids', () => {
    expect(
      duplicateTaskFilesToReassign([
        task({ id: 'a', filePath: 'D:/tasks/a.tctask', name: 'А' }),
        task({ id: 'b', filePath: 'D:/tasks/b.tctask', name: 'Б' }),
      ]),
    ).toEqual([]);
  });
});

describe('overlayOpenTask', () => {
  it('does not replace the copy name when the source task is open', () => {
    const tasks = [
      task({
        id: 'same',
        filePath: 'D:/tasks/source.tctask',
        name: 'Исходная',
        shortName: 'И',
      }),
      task({
        id: 'same',
        filePath: 'D:/tasks/copy.tctask',
        name: 'Копия',
        shortName: 'К',
      }),
    ];

    const shown = overlayOpenTask(tasks, {
      filePath: 'D:/tasks/source.tctask',
      document: {
        meta: { name: 'Исходная', shortName: 'И', parentTaskId: null },
      },
    });

    expect(shown[1]).toMatchObject({ name: 'Копия', shortName: 'К' });
    expect(shown[0]).toMatchObject({ name: 'Исходная', shortName: 'И' });
  });
});
