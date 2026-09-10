import type { RecentTask } from '@/domain/types';

export type TaskTreeNode = {
  task: RecentTask;
  children: TaskTreeNode[];
};

function parentIdOf(task: RecentTask): string | null {
  const parentId = task.parentTaskId?.trim();
  return parentId || null;
}

/** Build a forest from a flat recent-task list, preserving sibling order. */
export function buildTaskTree(tasks: RecentTask[]): TaskTreeNode[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const childrenByParent = new Map<string, RecentTask[]>();
  const roots: RecentTask[] = [];

  for (const task of tasks) {
    const parentId = parentIdOf(task);
    if (parentId && parentId !== task.id && byId.has(parentId)) {
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(task);
      childrenByParent.set(parentId, siblings);
    } else {
      roots.push(task);
    }
  }

  const toNode = (task: RecentTask, ancestors: Set<string>): TaskTreeNode => {
    if (ancestors.has(task.id)) {
      return { task, children: [] };
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(task.id);
    return {
      task,
      children: (childrenByParent.get(task.id) ?? []).map((child) =>
        toNode(child, nextAncestors),
      ),
    };
  };

  return roots.map((task) => toNode(task, new Set()));
}

export function collectDescendantIds(nodes: TaskTreeNode[], rootId: string): Set<string> {
  const ids = new Set<string>();

  const collectFrom = (node: TaskTreeNode) => {
    for (const child of node.children) {
      ids.add(child.task.id);
      collectFrom(child);
    }
  };

  const visit = (list: TaskTreeNode[]) => {
    for (const node of list) {
      if (node.task.id === rootId) {
        collectFrom(node);
        return true;
      }
      if (visit(node.children)) {
        return true;
      }
    }
    return false;
  };

  visit(nodes);
  return ids;
}

export function canNestTask(
  tasks: RecentTask[],
  taskId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) {
    return true;
  }
  if (taskId === newParentId) {
    return false;
  }
  const descendants = collectDescendantIds(buildTaskTree(tasks), taskId);
  return !descendants.has(newParentId);
}

export function filterTaskTree(
  nodes: TaskTreeNode[],
  matches: (task: RecentTask) => boolean,
): TaskTreeNode[] {
  return nodes.flatMap((node) => {
    const selfMatch = matches(node.task);
    const filteredChildren = filterTaskTree(node.children, matches);
    if (selfMatch) {
      return [{ ...node }];
    }
    if (filteredChildren.length > 0) {
      return [{ ...node, children: filteredChildren }];
    }
    return [];
  });
}

/** Parent ids on the path to the given task, so nested items can stay expanded. */
export function collectAncestorIds(nodes: TaskTreeNode[], targetId: string): string[] {
  const walk = (list: TaskTreeNode[], ancestors: string[]): string[] | null => {
    for (const node of list) {
      if (node.task.id === targetId) {
        return ancestors;
      }
      const found = walk(node.children, [...ancestors, node.task.id]);
      if (found) {
        return found;
      }
    }
    return null;
  };

  return walk(nodes, []) ?? [];
}

/** Parent ids that should be expanded so nested matches stay visible. */
export function collectExpandableIds(nodes: TaskTreeNode[]): string[] {
  const ids: string[] = [];

  const walk = (node: TaskTreeNode) => {
    if (node.children.length > 0) {
      ids.push(node.task.id);
      node.children.forEach(walk);
    }
  };

  nodes.forEach(walk);
  return ids;
}

export function flattenTaskTree(nodes: TaskTreeNode[]): Array<{
  task: RecentTask;
  depth: number;
}> {
  const result: Array<{ task: RecentTask; depth: number }> = [];

  const walk = (list: TaskTreeNode[], depth: number) => {
    for (const node of list) {
      result.push({ task: node.task, depth });
      walk(node.children, depth + 1);
    }
  };

  walk(nodes, 0);
  return result;
}
