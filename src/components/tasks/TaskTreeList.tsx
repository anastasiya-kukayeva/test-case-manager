import { ActionIcon, Badge, Collapse, Group, Text, Tooltip } from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconArrowsMove,
  IconTrash,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { OpenTaskState, RecentTask } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import type { TaskTreeNode } from '@/domain/utils/taskTree';

type TaskTreeListProps = {
  nodes: TaskTreeNode[];
  current: OpenTaskState | null;
  expandedIds: string[];
  busyKey: string | null;
  onToggle: (taskId: string) => void;
  onOpen: (filePath: string) => void;
  onCopy?: (task: RecentTask) => void;
  onMove?: (task: RecentTask) => void;
  onRemove?: (filePath: string, name: string) => void;
  /** Copy / move / remove icons. Default true. */
  showManagementActions?: boolean;
  /** Extra badge (e.g. regression case count) per task id */
  countByTaskId?: Record<string, number>;
};

type TaskTreeNodeRowProps = Omit<TaskTreeListProps, 'nodes'> & {
  node: TaskTreeNode;
  reduceMotion: boolean | null;
};

function isCurrentTask(task: RecentTask, current: OpenTaskState | null): boolean {
  if (!current) {
    return false;
  }
  return (
    Boolean(current.filePath && current.filePath === task.filePath) ||
    current.document.meta.id === task.id
  );
}

function TaskTreeNodeRow({
  node,
  current,
  expandedIds,
  busyKey,
  onToggle,
  onOpen,
  onCopy,
  onMove,
  onRemove,
  showManagementActions = true,
  countByTaskId,
  reduceMotion,
}: TaskTreeNodeRowProps) {
  const { task, children } = node;
  const isCurrent = isCurrentTask(task, current);
  const hasChildren = children.length > 0;
  const expanded = hasChildren && expandedIds.includes(task.id);
  const rowBusy = busyKey === task.filePath || busyKey === task.id;
  const extraCount = countByTaskId?.[task.id];

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Group
        justify="space-between"
        wrap="nowrap"
        py="sm"
        px="xs"
        style={{
          cursor: 'pointer',
          borderRadius: 'var(--mantine-radius-md)',
          background: isCurrent ? 'var(--mantine-color-blue-light)' : undefined,
        }}
        className="tcm-task-list-row"
        onClick={() => onOpen(task.filePath)}
      >
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          {hasChildren ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={expanded ? 'Свернуть подзадачи' : 'Показать подзадачи'}
              onClick={(event) => {
                event.stopPropagation();
                onToggle(task.id);
              }}
            >
              {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>
          ) : (
            <span style={{ width: 22, flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate>
                {getTaskShortLabel(task)}
              </Text>
              {extraCount !== undefined ? (
                <Badge size="xs" variant="light">
                  {extraCount}
                </Badge>
              ) : hasChildren ? (
                <Badge size="xs" variant="light">
                  {children.length}
                </Badge>
              ) : null}
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {task.filePath}
            </Text>
          </div>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">
            {dayjs(task.openedAt).format('DD.MM.YYYY HH:mm')}
          </Text>
          {showManagementActions ? (
            <>
              <Tooltip label="Копировать задачу">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Копировать задачу"
                  loading={rowBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCopy?.(task);
                  }}
                >
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Переместить в другую задачу">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Переместить задачу"
                  disabled={rowBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMove?.(task);
                  }}
                >
                  <IconArrowsMove size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Убрать из списка">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Убрать из списка"
                  disabled={rowBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove?.(task.filePath, task.name);
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          ) : null}
        </Group>
      </Group>

      {hasChildren ? (
        <Collapse in={expanded}>
          <div className="tcm-task-list-subtasks">
            <TaskTreeList
              nodes={children}
              current={current}
              expandedIds={expandedIds}
              busyKey={busyKey}
              onToggle={onToggle}
              onOpen={onOpen}
              onCopy={onCopy}
              onMove={onMove}
              onRemove={onRemove}
              showManagementActions={showManagementActions}
              countByTaskId={countByTaskId}
            />
          </div>
        </Collapse>
      ) : null}
    </motion.div>
  );
}

export function TaskTreeList({
  nodes,
  current,
  expandedIds,
  busyKey,
  onToggle,
  onOpen,
  onCopy,
  onMove,
  onRemove,
  showManagementActions = true,
  countByTaskId,
}: TaskTreeListProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {nodes.map((node) => (
        <TaskTreeNodeRow
          key={`${node.task.id}-${node.task.filePath}`}
          node={node}
          current={current}
          expandedIds={expandedIds}
          busyKey={busyKey}
          reduceMotion={reduceMotion}
          onToggle={onToggle}
          onOpen={onOpen}
          onCopy={onCopy}
          onMove={onMove}
          onRemove={onRemove}
          showManagementActions={showManagementActions}
          countByTaskId={countByTaskId}
        />
      ))}
    </AnimatePresence>
  );
}
