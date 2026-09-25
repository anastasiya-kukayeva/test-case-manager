import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  isRegressionMode,
  loadRegressionGroups,
  REGRESSION_MODE_LABELS,
  type RegressionApplicationGroup,
  type RegressionMode,
  type RegressionTaskItem,
} from '@/application/regression/loadRegressionGroups';
import { projectActions } from '@/application/project/projectActions';
import { FadeIn } from '@/components/ui/FadeIn';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

export function RegressionBrowsePage() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const mode: RegressionMode | null = isRegressionMode(modeParam) ? modeParam : null;
  const recentProjects = useAppStore((state) => state.recentProjects);
  const applications = useDirectoryStore((state) => state.applications);
  const modules = useDirectoryStore((state) => state.modules);
  const isDirectoryLoaded = useDirectoryStore((state) => state.isLoaded);
  const loadDirectory = useDirectoryStore((state) => state.load);
  const current = useProjectStore((state) => state.current);

  const [groups, setGroups] = useState<RegressionApplicationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!mode) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!useDirectoryStore.getState().isLoaded) {
        await loadDirectory();
      }
      setGroups(await loadRegressionGroups(mode));
    } catch (loadError) {
      setGroups([]);
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить регресс');
    } finally {
      setLoading(false);
    }
  }, [loadDirectory, mode]);

  useEffect(() => {
    void reload();
  }, [
    reload,
    recentProjects,
    applications,
    modules,
    isDirectoryLoaded,
    current?.document.meta.id,
    current?.document.meta.application,
    current?.document.meta.module,
    current?.document.testCases,
  ]);

  const openTask = async (task: RegressionTaskItem) => {
    if (!mode) {
      return;
    }
    setOpeningId(task.taskId);
    try {
      const open = useProjectStore.getState().current;
      const sameTask =
        Boolean(open) &&
        ((task.taskFilePath && open?.filePath === task.taskFilePath) ||
          open?.document.meta.id === task.taskId);

      if (!sameTask) {
        if (!task.taskFilePath || task.taskFilePath.startsWith('__unsaved__')) {
          setError('Файл задачи не сохранён — откройте задачу вручную.');
          return;
        }
        const ok = await projectActions.openRecent(task.taskFilePath, {
          preserveRecentOrder: true,
        });
        if (!ok) {
          return;
        }
      }

      void navigate(AppRoutes.regressionCases, { state: { mode } });
    } finally {
      setOpeningId(null);
    }
  };

  if (!mode) {
    return (
      <Stack gap="md">
        <Alert color="yellow" title="Неизвестный список">
          Вернитесь к выбору регресса.
        </Alert>
        <Button w="fit-content" onClick={() => void navigate(AppRoutes.regression)}>
          К регрессу
        </Button>
      </Stack>
    );
  }

  const title = REGRESSION_MODE_LABELS[mode];

  return (
    <Stack gap="lg">
      <Button
        variant="subtle"
        w="fit-content"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => void navigate(AppRoutes.regression)}
      >
        К выбору регресса
      </Button>

      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>{title}</Title>
            <Text c="dimmed" mt="xs">
              Приложения, внутри — модули, внутри модуля — задачи с этим модулем.
            </Text>
          </div>
          <Tooltip label="Обновить">
            <ActionIcon variant="default" onClick={() => void reload()} loading={loading}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </FadeIn>

      {error ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Ошибка">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Загрузка…
          </Text>
        </Group>
      ) : null}

      {!loading && groups.length === 0 ? (
        <Alert color="gray" title="Нет задач">
          Нет задач с кейсами для списка «{title}». Отметьте нужный чекбокс в тест-кейсе и укажите
          приложение и модуль в карточке задачи.
        </Alert>
      ) : null}

      {!loading && groups.length > 0 ? (
        <FadeIn>
          <Accordion multiple variant="separated" radius="lg">
            {groups.map((group) => {
              const taskCount = group.modules.reduce((sum, moduleGroup) => sum + moduleGroup.tasks.length, 0);
              return (
                <Accordion.Item key={group.applicationName} value={group.applicationName}>
                  <Accordion.Control>
                    <Group justify="space-between" pr="md" wrap="nowrap">
                      <Text fw={700} lineClamp={1}>
                        {group.applicationName}
                      </Text>
                      <Badge variant="light">{taskCount}</Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Accordion multiple variant="contained" radius="md">
                      {group.modules.map((moduleGroup) => (
                        <Accordion.Item
                          key={`${group.applicationName}:${moduleGroup.moduleName}`}
                          value={`${group.applicationName}:${moduleGroup.moduleName}`}
                        >
                          <Accordion.Control>
                            <Group justify="space-between" pr="md" wrap="nowrap">
                              <Text fw={600} lineClamp={1}>
                                {moduleGroup.moduleName}
                              </Text>
                              <Badge variant="outline">{moduleGroup.tasks.length}</Badge>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            <Stack gap={4}>
                              {moduleGroup.tasks.map((task) => (
                                <UnstyledButton
                                  key={task.taskId}
                                  onClick={() => void openTask(task)}
                                  disabled={openingId === task.taskId}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    textAlign: 'left',
                                  }}
                                  className="tcm-app-task-row"
                                >
                                  <Group justify="space-between" wrap="nowrap">
                                    <div style={{ minWidth: 0 }}>
                                      <Text fw={600} size="sm">
                                        {task.taskShortLabel}
                                      </Text>
                                      {task.taskShortLabel !== task.taskName ? (
                                        <Text size="xs" c="dimmed" lineClamp={1}>
                                          {task.taskName}
                                        </Text>
                                      ) : null}
                                    </div>
                                    <Badge variant="light">{task.caseCount}</Badge>
                                  </Group>
                                </UnstyledButton>
                              ))}
                            </Stack>
                          </Accordion.Panel>
                        </Accordion.Item>
                      ))}
                    </Accordion>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </FadeIn>
      ) : null}
    </Stack>
  );
}
