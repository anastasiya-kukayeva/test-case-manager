import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconCopy,
  IconArrowsMove,
  IconDeviceFloppy,
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { taskHierarchyActions } from '@/application/project/taskHierarchyActions';
import { confirmAction } from '@/application/ui/confirmAction';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { MoveTaskModal } from '@/components/tasks/MoveTaskModal';
import { TaskTreeList } from '@/components/tasks/TaskTreeList';
import { FadeIn } from '@/components/ui/FadeIn';
import type { RecentTask } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import {
  buildTaskTree,
  collectAncestorIds,
  collectExpandableIds,
  filterTaskTree,
} from '@/domain/utils/taskTree';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUiStore } from '@/stores/useUiStore';

function idsToKeepExpanded(tree: ReturnType<typeof buildTaskTree>, taskId: string): string[] {
  const ancestors = collectAncestorIds(tree, taskId);
  const expandable = new Set(collectExpandableIds(tree));
  if (expandable.has(taskId)) {
    return [...ancestors, taskId];
  }
  return ancestors;
}

function mergeExpandedIds(currentIds: string[], extra: string[]): string[] {
  const missing = extra.filter((id) => !currentIds.includes(id));
  return missing.length === 0 ? currentIds : [...currentIds, ...missing];
}

function matchesTaskQuery(
  query: string,
  task: { name: string; shortName?: string; filePath?: string },
): boolean {
  const normalized = query.trim().toLocaleLowerCase('ru');
  if (!normalized) {
    return true;
  }
  const haystacks = [task.name, task.shortName ?? '', task.filePath ?? '', getTaskShortLabel(task)];
  return haystacks.some((value) => value.toLocaleLowerCase('ru').includes(normalized));
}

export function TasksListPage() {
  const navigate = useNavigate();
  const recentProjects = useAppStore((state) => state.recentProjects);
  const setRecentProjects = useAppStore((state) => state.setRecentProjects);
  const current = useProjectStore((state) => state.current);
  const [createOpened, setCreateOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const expandedIds = useUiStore((state) => state.taskListExpandedIds);
  const setExpandedIds = useUiStore((state) => state.setTaskListExpandedIds);
  const [moveTask, setMoveTask] = useState<RecentTask | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const showUnsaved =
    Boolean(current && !current.filePath) &&
    matchesTaskQuery(searchQuery, {
      name: current!.document.meta.name,
      shortName: current!.document.meta.shortName,
      filePath: '',
    });

  const tasksForTree = useMemo(() => {
    if (!current) {
      return recentProjects;
    }
    return recentProjects.map((item) => {
      const sameFile = Boolean(current.filePath) && item.filePath === current.filePath;
      const sameId = item.id === current.document.meta.id;
      if (!sameFile && !sameId) {
        return item;
      }
      return {
        ...item,
        name: current.document.meta.name,
        shortName: current.document.meta.shortName || item.shortName,
        parentTaskId: current.document.meta.parentTaskId ?? item.parentTaskId,
      };
    });
  }, [recentProjects, current]);

  const taskTree = useMemo(() => {
    const tree = buildTaskTree(tasksForTree);
    if (!searchQuery.trim()) {
      return tree;
    }
    return filterTaskTree(tree, (task) => matchesTaskQuery(searchQuery, task));
  }, [tasksForTree, searchQuery]);

  const restoredForTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    const taskId = current?.document.meta.id;
    if (!taskId || taskTree.length === 0) {
      return;
    }
    if (restoredForTaskIdRef.current === taskId) {
      return;
    }
    const ancestors = idsToKeepExpanded(taskTree, taskId);
    restoredForTaskIdRef.current = taskId;
    if (ancestors.length === 0) {
      return;
    }
    setExpandedIds((ids) => mergeExpandedIds(ids, ancestors));
  }, [current?.document.meta.id, taskTree, setExpandedIds]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    setExpandedIds(collectExpandableIds(taskTree));
  }, [searchQuery, taskTree, setExpandedIds]);

  const listEmpty = recentProjects.length === 0 && !(current && !current.filePath);
  const noMatches = !listEmpty && !showUnsaved && taskTree.length === 0;

  const handleRemoveRecent = async (filePath: string, name: string) => {
    const confirmed = await confirmAction({
      title: 'Убрать из недавних?',
      message: `«${name}» будет удалена только из списка недавних. Файл на диске не затрагивается.`,
      confirmLabel: 'Убрать',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return;
    }

    const next = recentProjects.filter((item) => item.filePath !== filePath);
    setRecentProjects(next);
    if (appStorageService.isAvailable()) {
      await appStorageService.saveRecentProjects(next);
      const lastPath = await appStorageService.getLastOpenedProjectPath();
      if (lastPath === filePath) {
        await appStorageService.setLastOpenedProjectPath(null);
      }
    }
    notifySuccess('Убрано из недавних');
  };

  const openTask = async (filePath: string | null) => {
    if (filePath && !filePath.startsWith('__unsaved__')) {
      const task = tasksForTree.find((item) => item.filePath === filePath);
      if (task) {
        const ancestors = idsToKeepExpanded(taskTree, task.id);
        if (ancestors.length > 0) {
          setExpandedIds((ids) => mergeExpandedIds(ids, ancestors));
        }
      }
    }
    if (!filePath || filePath.startsWith('__unsaved__')) {
      void navigate(AppRoutes.taskCurrent);
      return;
    }
    const ok = await projectActions.openRecent(filePath, { preserveRecentOrder: true });
    if (ok) {
      void navigate(AppRoutes.taskCurrent);
    }
  };

  const unsavedAsRecent = (): RecentTask | null => {
    if (!current || current.filePath) {
      return null;
    }
    return {
      id: current.document.meta.id,
      name: current.document.meta.name,
      shortName: current.document.meta.shortName || undefined,
      filePath: '',
      openedAt: current.document.meta.updatedAt,
      parentTaskId: current.document.meta.parentTaskId ?? null,
    };
  };

  const handleCopy = async (task: RecentTask) => {
    setBusyKey(task.filePath || task.id);
    try {
      await taskHierarchyActions.duplicate({
        id: task.id,
        name: task.name,
        shortName: task.shortName,
        filePath: task.filePath || null,
        parentTaskId: task.parentTaskId,
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleMoveConfirm = async (parentTaskId: string | null) => {
    if (!moveTask) {
      return;
    }
    setBusyKey(moveTask.filePath || moveTask.id);
    try {
      const ok = await taskHierarchyActions.move(
        {
          id: moveTask.id,
          name: moveTask.name,
          shortName: moveTask.shortName,
          filePath: moveTask.filePath || null,
          parentTaskId: moveTask.parentTaskId,
        },
        parentTaskId,
      );
      if (ok) {
        setMoveTask(null);
        if (parentTaskId) {
          setExpandedIds((currentIds) =>
            currentIds.includes(parentTaskId) ? currentIds : [...currentIds, parentTaskId],
          );
        }
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggle = (taskId: string) => {
    setExpandedIds((currentIds) =>
      currentIds.includes(taskId)
        ? currentIds.filter((id) => id !== taskId)
        : [...currentIds, taskId],
    );
  };

  return (
    <Stack gap="lg">
      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Задачи</Title>
            <Text c="dimmed" mt="xs">
              Список всех заведённых задач. Выберите задачу, чтобы открыть её карточку.
            </Text>
          </div>
          <Group>
            <Button
              variant="default"
              leftSection={<IconFolderOpen size={16} />}
              onClick={() =>
                void projectActions.open().then((ok) => {
                  if (ok) {
                    void navigate(AppRoutes.taskCurrent);
                  }
                })
              }
            >
              Открыть файл…
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
              Новая задача
            </Button>
          </Group>
        </Group>
      </FadeIn>

      <FadeIn delay={0.04}>
        <TextInput
          placeholder="Поиск по названию или пути…"
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.currentTarget?.value ?? event.target?.value ?? '');
          }}
          rightSection={
            searchQuery.trim() ? (
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label="Очистить поиск"
                onClick={() => setSearchQuery('')}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card withBorder padding="lg" radius="lg">
          <Stack gap="sm">
            {listEmpty ? (
              <Text c="dimmed" size="sm">
                Список пуст. Создайте задачу и сохраните файл *.tctask — иначе она пропадёт после
                закрытия приложения.
              </Text>
            ) : noMatches ? (
              <Text c="dimmed" size="sm">
                Ничего не найдено по запросу «{searchQuery.trim()}».
              </Text>
            ) : (
              <AnimatePresence initial={false}>
                {showUnsaved && current && !current.filePath ? (
                  <motion.div
                    key={`unsaved-${current.document.meta.id}`}
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
                      }}
                      className="tcm-task-list-row"
                      onClick={() => void navigate(AppRoutes.taskCurrent)}
                    >
                      <div style={{ minWidth: 0 }}>
                        <Group gap={6} wrap="nowrap">
                          <Text size="sm" fw={600} truncate>
                            {getTaskShortLabel(current.document.meta)}
                          </Text>
                          <Badge size="xs" color="orange" variant="light">
                            Не сохранена
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" truncate>
                          Только в памяти — сохраните, чтобы не потерять
                        </Text>
                      </div>
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label="Копировать задачу">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label="Копировать задачу"
                            loading={Boolean(current && busyKey === current.document.meta.id)}
                            onClick={(event) => {
                              event.stopPropagation();
                              const unsaved = unsavedAsRecent();
                              if (unsaved) {
                                void handleCopy(unsaved);
                              }
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
                            disabled={recentProjects.length === 0}
                            onClick={(event) => {
                              event.stopPropagation();
                              setMoveTask(unsavedAsRecent());
                            }}
                          >
                            <IconArrowsMove size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Button
                          size="xs"
                          variant="filled"
                          leftSection={<IconDeviceFloppy size={14} />}
                          onClick={(event) => {
                            event.stopPropagation();
                            void projectActions.saveAs().then((ok) => {
                              if (ok) {
                                void navigate(AppRoutes.taskCurrent);
                              }
                            });
                          }}
                        >
                          Сохранить
                        </Button>
                      </Group>
                    </Group>
                  </motion.div>
                ) : null}

                {taskTree.length > 0 ? (
                  <TaskTreeList
                    key="task-tree"
                    nodes={taskTree}
                    current={current}
                    expandedIds={expandedIds}
                    busyKey={busyKey}
                    onToggle={handleToggle}
                    onOpen={(filePath) => void openTask(filePath)}
                    onCopy={(task) => void handleCopy(task)}
                    onMove={setMoveTask}
                    onRemove={(filePath, name) => void handleRemoveRecent(filePath, name)}
                  />
                ) : null}
              </AnimatePresence>
            )}
          </Stack>
        </Card>
      </FadeIn>

      <CreateProjectModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        onCreated={() => void navigate(AppRoutes.taskCurrent)}
      />

      <MoveTaskModal
        opened={Boolean(moveTask)}
        task={moveTask}
        tasks={tasksForTree}
        confirming={Boolean(busyKey && moveTask && (busyKey === moveTask.filePath || busyKey === moveTask.id))}
        onClose={() => setMoveTask(null)}
        onConfirm={(parentTaskId) => void handleMoveConfirm(parentTaskId)}
      />
    </Stack>
  );
}
