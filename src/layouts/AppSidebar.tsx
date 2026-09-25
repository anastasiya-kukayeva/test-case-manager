import { NavLink as MantineNavLink, Stack, Text } from '@mantine/core';
import {
  IconApps,
  IconBook2,
  IconChecklist,
  IconHome2,
  IconListDetails,
  IconRepeat,
  IconSettings,
} from '@tabler/icons-react';
import { NavLink, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/routes/paths';

export function AppSidebar() {
  const location = useLocation();

  const isOnTasks =
    location.pathname === AppRoutes.tasks || location.pathname === AppRoutes.taskCurrent;
  const isOnRegression =
    location.pathname === AppRoutes.regression ||
    location.pathname.startsWith('/regression/');

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
        component={NavLink}
        to={AppRoutes.tasks}
        label="Задачи"
        active={isOnTasks}
        leftSection={<IconChecklist size={18} stroke={1.5} />}
        variant="filled"
      />

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
        to={AppRoutes.regression}
        label="Регресс"
        active={isOnRegression}
        leftSection={<IconRepeat size={18} stroke={1.5} />}
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
