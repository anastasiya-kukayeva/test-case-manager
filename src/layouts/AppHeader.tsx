import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconFolderOpen,
  IconLayoutSidebar,
  IconMoon,
  IconPlus,
  IconSun,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectActions } from '@/application/project/projectActions';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { useColorSchemePreference } from '@/hooks/useColorSchemePreference';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

type AppHeaderProps = {
  onToggleSidebar: () => void;
};

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const navigate = useNavigate();
  const { setColorScheme } = useMantineColorScheme();
  const { setColorScheme: persistColorScheme } = useColorSchemePreference();
  const computedColorScheme = useComputedColorScheme('light');
  const currentProject = useProjectStore((state) => state.current);
  const hotkeys = useAppStore((state) => state.settings.hotkeys);
  const [createOpened, setCreateOpened] = useState(false);

  const toggleColorScheme = () => {
    const next = computedColorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(next);
    persistColorScheme(next);
  };

  return (
    <>
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
          <Menu shadow="md" width={260}>
            <Menu.Target>
              <Button variant="light" size="sm">
                Файл
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPlus size={16} />} onClick={() => setCreateOpened(true)}>
                Новая задача
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFolderOpen size={16} />}
                onClick={() =>
                  void projectActions.open().then((ok) => {
                    if (ok) {
                      void navigate(AppRoutes.taskCurrent);
                    }
                  })
                }
              >
                Открыть… (Ctrl+O)
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconDeviceFloppy size={16} />}
                disabled={!currentProject}
                onClick={() => void projectActions.save()}
              >
                Сохранить ({hotkeys.save})
              </Menu.Item>
              <Menu.Item
                leftSection={<IconDeviceFloppy size={16} />}
                disabled={!currentProject}
                onClick={() => void projectActions.saveAs()}
              >
                Сохранить как… ({hotkeys.saveAs})
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                disabled={!currentProject}
                onClick={() => void projectActions.close()}
              >
                Закрыть задачу
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

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

      <CreateProjectModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        onCreated={() => void navigate(AppRoutes.taskCurrent)}
      />
    </>
  );
}
