import { describe, expect, it } from 'vitest';
import type { RecentTask } from '@/domain/types';
import {
  buildTaskTree,
  canNestTask,
  collectAncestorIds,
  collectDescendantIds,
  collectExpandableIds,
  collectSubtreeTaskIds,
  filterTaskTree,
  flattenTaskTree,
  rootTaskId,
} from '@/domain/utils/taskTree';

function task(partial: Partial<RecentTask> & { id: string }): RecentTask {
  return {
    name: partial.id,
    filePath: `${partial.id}.tctask`,
    openedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('buildTaskTree', () => {
  const tasks = [
    task({ id: 'root', name: 'Корень' }),
    task({ id: 'child-b', name: 'Б', parentTaskId: 'root' }),
    task({ id: 'child-a', name: 'А', parentTaskId: 'root' }),
    task({ id: 'grand', name: 'Внук', parentTaskId: 'child-a' }),
    task({ id: 'orphan', name: 'Сирота', parentTaskId: 'missing' }),
    task({ id: 'self', name: 'Сам себе', parentTaskId: 'self' }),
    task({ id: 'blank-parent', name: 'Пустой родитель', parentTaskId: '   ' }),
  ];

  it('keeps sibling order and treats missing, self and blank parents as roots', () => {
    const tree = buildTaskTree(tasks);

    expect(tree.map((node) => node.task.id)).toEqual(['root', 'orphan', 'self', 'blank-parent']);
    expect(tree[0]?.children.map((node) => node.task.id)).toEqual(['child-b', 'child-a']);
    expect(tree[0]?.children[1]?.children.map((node) => node.task.id)).toEqual(['grand']);
  });

  it('stops on a parent cycle instead of looping', () => {
    expect(
      buildTaskTree([task({ id: 'a', parentTaskId: 'b' }), task({ id: 'b', parentTaskId: 'a' })]),
    ).toEqual([]);
  });
});

describe('task nesting rules', () => {
  const tasks = [
    task({ id: 'root' }),
    task({ id: 'child', parentTaskId: 'root' }),
    task({ id: 'grand', parentTaskId: 'child' }),
  ];
  const tree = buildTaskTree(tasks);

  it('collects descendants, the subtree and the root of a chain', () => {
    expect([...collectDescendantIds(tree, 'root')].sort()).toEqual(['child', 'grand']);
    expect([...collectSubtreeTaskIds(tasks, 'child')].sort()).toEqual(['child', 'grand']);
    expect(rootTaskId(tasks, 'grand')).toBe('root');
    expect(rootTaskId(tasks, 'missing')).toBe('missing');
  });

  it('refuses to nest a task under itself or its descendant', () => {
    expect(canNestTask(tasks, 'root', 'grand')).toBe(false);
    expect(canNestTask(tasks, 'child', 'child')).toBe(false);
    expect(canNestTask(tasks, 'grand', 'root')).toBe(true);
    expect(canNestTask(tasks, 'child', null)).toBe(true);
  });

  it('walks a parent cycle without hanging and still returns a member of the cycle', () => {
    const cycle = [task({ id: 'a', parentTaskId: 'b' }), task({ id: 'b', parentTaskId: 'a' })];

    expect(rootTaskId(cycle, 'a')).toBe('a');
    expect([...collectSubtreeTaskIds(cycle, 'a')].sort()).toEqual(['a', 'b']);
  });
});

describe('filterTaskTree', () => {
  const tree = buildTaskTree([
    task({ id: 'root', name: 'Корень' }),
    task({ id: 'keep', name: 'Оплата', parentTaskId: 'root' }),
    task({ id: 'drop', name: 'Архив', parentTaskId: 'root' }),
    task({ id: 'nested', name: 'Вложенный', parentTaskId: 'keep' }),
  ]);

  it('keeps ancestors of a match and the full branch under a matched task', () => {
    const filtered = filterTaskTree(tree, (item) => item.name === 'Оплата');

    expect(filtered.map((node) => node.task.id)).toEqual(['root']);
    expect(filtered[0]?.children.map((node) => node.task.id)).toEqual(['keep']);
    expect(filtered[0]?.children[0]?.children.map((node) => node.task.id)).toEqual(['nested']);
  });

  it('lists ancestors and expandable parents for the visible branch', () => {
    const filtered = filterTaskTree(tree, (item) => item.name === 'Вложенный');

    expect(collectAncestorIds(filtered, 'nested')).toEqual(['root', 'keep']);
    expect(collectExpandableIds(filtered)).toEqual(['root', 'keep']);
    expect(flattenTaskTree(filtered).map((item) => [item.task.id, item.depth])).toEqual([
      ['root', 0],
      ['keep', 1],
      ['nested', 2],
    ]);
  });
});
