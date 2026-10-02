import {
  ActionIcon,
  Badge,
  Group,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconLayoutSidebar, IconMoon, IconSun } from '@tabler/icons-react';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { useColorSchemePreference } from '@/hooks/useColorSchemePreference';
import { useProjectStore } from '@/stores/useProjectStore';

type AppHeaderProps = {
  onToggleSidebar: () => void;
};

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const { setColorScheme } = useMantineColorScheme();
  const { setColorScheme: persistColorScheme } = useColorSchemePreference();
  const computedColorScheme = useComputedColorScheme('light');
  const currentProject = useProjectStore((state) => state.current);

  const toggleColorScheme = () => {
    const next = computedColorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(next);
    persistColorScheme(next);
  };

  return (
    <Group h="100%" px="md" justify="space-between">
        <Group gap="sm">
          <Tooltip label="Показать / скрыть меню">
            <ActionIcon
              variant="subtle"
              size="lg"
              aria-label="Toggle sidebar"
              onClick={onToggleSidebar}
            >
              <IconLayoutSidebar size={20} />
            </ActionIcon>
          </Tooltip>
          <div>
            <Text fw={700} size="lg" lh={1.2}>
              Test Case Manager
            </Text>
            {currentProject ? (
              <Group gap={6} mt={2}>
                <Text size="xs" c="dimmed" lineClamp={1} maw={360}>
                  {getTaskShortLabel(currentProject.document.meta)}
                </Text>
                {currentProject.isDirty ? (
                  <Badge size="xs" color="orange" variant="light">
                    Не сохранено
                  </Badge>
                ) : (
                  <Badge size="xs" color="green" variant="light">
                    Сохранено
                  </Badge>
                )}
              </Group>
            ) : null}
          </div>
        </Group>

        <Group gap="xs">
          <Tooltip label={computedColorScheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Toggle color scheme"
              onClick={toggleColorScheme}
            >
              {computedColorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
  );
}
