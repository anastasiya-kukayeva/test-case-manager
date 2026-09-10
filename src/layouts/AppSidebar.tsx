import { NavLink as MantineNavLink, Stack, Text } from '@mantine/core';
import {
  IconApps,
  IconBook2,
  IconChecklist,
  IconHome2,
  IconListDetails,
  IconSettings,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { projectActions } from '@/application/project/projectActions';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { buildTaskTree, collectAncestorIds, type TaskTreeNode } from '@/domain/utils/taskTree';
import type { OpenTaskState, RecentTask } from '@/domain/types';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

function isSameTask(
  recent: RecentTask,
  current: { filePath: string | null; id: string } | null,
): boolean {
  if (!current) {
    return false;
  }
  if (current.filePath && recent.filePath === current.filePath) {
    return true;
  }
  return recent.id === current.id;
}

type SidebarTaskNodeProps = {
  node: TaskTreeNode;
  currentRef: { filePath: string | null; id: string } | null;
  currentTask: OpenTaskState | null;
  isOnTaskCurrent: boolean;
  isOnTestCases: boolean;
  expandedIds: string[];
  onToggle: (taskId: string, opened: boolean) => void;
  onOpen: (recent: RecentTask, isCurrent: boolean) => void;
};

function SidebarTaskNode({
  node,
  currentRef,
  currentTask,
  isOnTaskCurrent,
  isOnTestCases,
  expandedIds,
  onToggle,
  onOpen,
}: SidebarTaskNodeProps) {
  const { task, children } = node;
  const isCurrent = isSameTask(task, currentRef);
  const shortLabel =
    isCurrent && currentTask
      ? getTaskShortLabel(currentTask.document.meta)
      : getTaskShortLabel(task);
  const hasChildren = children.length > 0;
  const opened = hasChildren && expandedIds.includes(task.id);

  return (
    <MantineNavLink
      label={shortLabel}
      active={isCurrent && (isOnTaskCurrent || isOnTestCases)}
      leftSection={<IconChecklist size={16} stroke={1.5} />}
      variant="filled"
      opened={hasChildren ? opened : undefined}
      onChange={
        hasChildren
          ? (nextOpened) => {
              onToggle(task.id, nextOpened);
            }
          : undefined
      }
      childrenOffset={18}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (hasChildren && !opened) {
          onToggle(task.id, true);
        }
        onOpen(task, isCurrent);
      }}
    >
      {hasChildren
        ? children.map((child) => (
            <SidebarTaskNode
              key={`${child.task.id}-${child.task.filePath}`}
              node={child}
              currentRef={currentRef}
              currentTask={currentTask}
              isOnTaskCurrent={isOnTaskCurrent}
              isOnTestCases={isOnTestCases}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))
        : null}
    </MantineNavLink>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTask = useProjectStore((state) => state.current);
  const recentProjects = useAppStore((state) => state.recentProjects);
  const [tasksOpened, setTasksOpened] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const isOnTasksList = location.pathname === AppRoutes.tasks;
  const isOnTaskCurrent = location.pathname === AppRoutes.taskCurrent;
  const isOnTestCases =
    location.pathname === AppRoutes.testCases ||
    location.pathname.startsWith(`${AppRoutes.testCases}/`);

  const currentFilePath = currentTask?.filePath ?? null;
  const currentId = currentTask?.document.meta.id ?? null;

  /** Same source as the Задачи page: recents, with the open task’s latest parent/name. */
  const sidebarTasks = useMemo(() => {
    let list = [...recentProjects];

    if (currentTask && currentId) {
      list = list.map((item) => {
        const sameFile = Boolean(currentFilePath) && item.filePath === currentFilePath;
        const sameId = item.id === currentId;
        if (!sameFile && !sameId) {
          return item;
        }
        return {
          ...item,
          name: currentTask.document.meta.name,
          shortName: currentTask.document.meta.shortName || item.shortName,
          parentTaskId: currentTask.document.meta.parentTaskId ?? item.parentTaskId,
        };
      });

      const alreadyListed = list.some(
        (item) =>
          (currentFilePath ? item.filePath === currentFilePath : false) || item.id === currentId,
      );
      if (!alreadyListed && currentFilePath) {
        list.push({
          id: currentId,
          name: currentTask.document.meta.name,
          shortName: currentTask.document.meta.shortName || undefined,
          filePath: currentFilePath,
          openedAt: new Date().toISOString(),
          parentTaskId: currentTask.document.meta.parentTaskId ?? null,
        });
      }
    }

    return list;
  }, [recentProjects, currentTask, currentFilePath, currentId]);

  const unsavedTask = useMemo((): RecentTask | null => {
    if (!currentTask || currentFilePath || !currentId) {
      return null;
    }
    return {
      id: currentId,
      name: currentTask.document.meta.name,
      shortName: currentTask.document.meta.shortName || undefined,
      filePath: `__unsaved__${currentId}`,
      openedAt: new Date().toISOString(),
      parentTaskId: currentTask.document.meta.parentTaskId ?? null,
    };
  }, [currentTask, currentFilePath, currentId]);

  const taskTree = useMemo(() => buildTaskTree(sidebarTasks), [sidebarTasks]);

  const currentRef = currentTask
    ? { filePath: currentTask.filePath, id: currentTask.document.meta.id }
    : null;

  useEffect(() => {
    if (isOnTasksList || isOnTaskCurrent || isOnTestCases) {
      setTasksOpened(true);
    }
  }, [isOnTasksList, isOnTaskCurrent, isOnTestCases]);

  useEffect(() => {
    if (!currentId) {
      return;
    }
    const ancestors = collectAncestorIds(taskTree, currentId);
    if (ancestors.length === 0) {
      return;
    }
    setExpandedIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? [...next] : current;
    });
  }, [currentId, taskTree]);

  const openTask = (recent: RecentTask, isCurrent: boolean) => {
    if (isCurrent || recent.filePath.startsWith('__unsaved__')) {
      void navigate(AppRoutes.taskCurrent);
      return;
    }
    void projectActions.openRecent(recent.filePath, { preserveRecentOrder: true }).then((ok) => {
      if (ok) {
        void navigate(AppRoutes.taskCurrent);
      }
    });
  };

  const handleToggle = (taskId: string, opened: boolean) => {
    setExpandedIds((current) =>
      opened
        ? current.includes(taskId)
          ? current
          : [...current, taskId]
        : current.filter((id) => id !== taskId),
    );
  };

  const hasAnyTasks = Boolean(unsavedTask) || taskTree.length > 0;

  return (
    <Stack gap="xs" p="md" style={{ height: '100%', overflow: 'auto' }}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        Навигация
      </Text>

      <MantineNavLink
        component={NavLink}
        to={AppRoutes.home}
        end
        label="Главная"
        active={location.pathname === AppRoutes.home}
        leftSection={<IconHome2 size={18} stroke={1.5} />}
        variant="filled"
      />

      <MantineNavLink
        component={NavLink}
        to={AppRoutes.applications}
        label="Приложения"
        active={location.pathname === AppRoutes.applications}
        leftSection={<IconApps size={18} stroke={1.5} />}
        variant="filled"
      />

      <MantineNavLink
        label="Задачи"
        active={isOnTasksList}
        leftSection={<IconChecklist size={18} stroke={1.5} />}
        variant="filled"
        opened={tasksOpened}
        onChange={setTasksOpened}
        childrenOffset={28}
        onClick={(event) => {
          event.preventDefault();
          setTasksOpened((value) => !value);
          void navigate(AppRoutes.tasks);
        }}
      >
        {!hasAnyTasks ? (
          <MantineNavLink
            label="Нет задач"
            description="Создайте или откройте задачу"
            disabled
            leftSection={<IconChecklist size={16} stroke={1.5} />}
          />
        ) : (
          <>
            {unsavedTask ? (
              <MantineNavLink
                label={getTaskShortLabel(currentTask!.document.meta)}
                description="Не сохранена"
                active={isOnTaskCurrent || isOnTestCases}
                leftSection={<IconChecklist size={16} stroke={1.5} />}
                variant="filled"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openTask(unsavedTask, true);
                }}
              />
            ) : null}
            {taskTree.map((node) => (
              <SidebarTaskNode
                key={`${node.task.id}-${node.task.filePath}`}
                node={node}
                currentRef={currentRef}
                currentTask={currentTask}
                isOnTaskCurrent={isOnTaskCurrent}
                isOnTestCases={isOnTestCases}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onOpen={openTask}
              />
            ))}
          </>
        )}
      </MantineNavLink>

      <MantineNavLink
        component={NavLink}
        to={AppRoutes.allTestCases}
        label="Тест-кейсы"
        active={location.pathname === AppRoutes.allTestCases}
        leftSection={<IconListDetails size={18} stroke={1.5} />}
        variant="filled"
      />

      <MantineNavLink
        component={NavLink}
        to={AppRoutes.directory}
        label="Справочник"
        active={location.pathname === AppRoutes.directory}
        leftSection={<IconBook2 size={18} stroke={1.5} />}
        variant="filled"
      />

      <MantineNavLink
        component={NavLink}
        to={AppRoutes.settings}
        label="Настройки"
        active={location.pathname === AppRoutes.settings}
        leftSection={<IconSettings size={18} stroke={1.5} />}
        variant="filled"
      />
    </Stack>
  );
}
