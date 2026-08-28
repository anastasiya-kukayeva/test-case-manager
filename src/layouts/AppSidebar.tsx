import { NavLink as MantineNavLink, Stack, Text } from '@mantine/core';
import {
  IconApps,
  IconBook2,
  IconChecklist,
  IconHome2,
  IconListDetails,
  IconSettings,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { projectActions } from '@/application/project/projectActions';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import type { RecentTask } from '@/domain/types';
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

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTask = useProjectStore((state) => state.current);
  const recentProjects = useAppStore((state) => state.recentProjects);
  const [tasksOpened, setTasksOpened] = useState(false);

  const isOnTasksList = location.pathname === AppRoutes.tasks;
  const isOnTaskCurrent = location.pathname === AppRoutes.taskCurrent;
  const isOnTestCases =
    location.pathname === AppRoutes.testCases ||
    location.pathname.startsWith(`${AppRoutes.testCases}/`);

  const currentFilePath = currentTask?.filePath ?? null;
  const currentId = currentTask?.document.meta.id ?? null;

  /** Keep list order stable — never pull the open task to the top. */
  const sidebarTasks = useMemo(() => {
    const list = [...recentProjects];
    if (!currentTask || !currentId) {
      return list.slice(0, 10);
    }

    const alreadyListed = list.some(
      (item) =>
        (currentFilePath ? item.filePath === currentFilePath : false) || item.id === currentId,
    );
    if (!alreadyListed) {
      list.push({
        id: currentId,
        name: currentTask.document.meta.name,
        shortName: currentTask.document.meta.shortName || undefined,
        filePath: currentFilePath ?? `__unsaved__${currentId}`,
        openedAt: new Date().toISOString(),
      });
    }
    return list.slice(0, 10);
  }, [recentProjects, currentTask, currentFilePath, currentId]);

  const currentRef = currentTask
    ? { filePath: currentTask.filePath, id: currentTask.document.meta.id }
    : null;

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

  return (
    <Stack gap="xs" p="md">
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
        {sidebarTasks.length === 0 ? (
          <MantineNavLink
            label="Нет задач"
            description="Создайте или откройте задачу"
            disabled
            leftSection={<IconChecklist size={16} stroke={1.5} />}
          />
        ) : (
          sidebarTasks.map((recent) => {
            const isCurrent = isSameTask(recent, currentRef);
            const shortLabel = isCurrent
              ? getTaskShortLabel(currentTask!.document.meta)
              : getTaskShortLabel(recent);

            return (
              <MantineNavLink
                key={recent.filePath}
                label={shortLabel}
                active={isCurrent && (isOnTaskCurrent || isOnTestCases)}
                leftSection={<IconChecklist size={16} stroke={1.5} />}
                variant="filled"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openTask(recent, isCurrent);
                }}
              />
            );
          })
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
