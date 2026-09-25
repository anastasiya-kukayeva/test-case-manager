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
import { IconAlertCircle, IconApps, IconPlus, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loadApplicationTaskGroups,
  type ApplicationGroup,
  type ApplicationTaskItem,
} from '@/application/applications/loadApplicationTaskGroups';
import { projectActions } from '@/application/project/projectActions';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { FadeIn } from '@/components/ui/FadeIn';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

const UNASSIGNED_LABEL = 'Без приложения';

export function ApplicationsPage() {
  const navigate = useNavigate();
  const recentProjects = useAppStore((state) => state.recentProjects);
  const applications = useDirectoryStore((state) => state.applications);
  const isDirectoryLoaded = useDirectoryStore((state) => state.isLoaded);
  const loadDirectory = useDirectoryStore((state) => state.load);
  const current = useProjectStore((state) => state.current);

  const [groups, setGroups] = useState<ApplicationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [createOpened, setCreateOpened] = useState(false);
  const [createApplication, setCreateApplication] = useState('');
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!useDirectoryStore.getState().isLoaded) {
        await loadDirectory();
      }
      const next = await loadApplicationTaskGroups();
      setGroups(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить приложения');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [loadDirectory]);

  useEffect(() => {
    void reload();
  }, [
    reload,
    recentProjects,
    applications,
    isDirectoryLoaded,
    current?.document.meta.id,
    current?.document.meta.application,
  ]);

  const openTask = async (task: ApplicationTaskItem) => {
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

      void navigate(AppRoutes.taskCurrent);
    } finally {
      setOpeningId(null);
    }
  };

  const openCreateForApplication = (applicationName: string) => {
    setCreateApplication(applicationName === UNASSIGNED_LABEL ? '' : applicationName);
    setCreateOpened(true);
  };

  return (
    <Stack gap="lg">
      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Приложения</Title>
            <Text c="dimmed" mt="xs">
              Задачи, сгруппированные по приложениям из справочника.
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
            Загрузка приложений…
          </Text>
        </Group>
      ) : null}

      {!loading && groups.length === 0 ? (
        <Alert color="gray" title="Нет приложений" icon={<IconApps size={16} />}>
          Добавьте приложение в разделе «Справочник», затем выберите его в карточке задачи.
        </Alert>
      ) : null}

      {!loading && groups.length > 0 ? (
        <FadeIn>
          <Accordion multiple variant="separated" radius="lg" defaultValue={[]}>
            {groups.map((group) => (
              <Accordion.Item
                key={group.applicationId ?? `name:${group.applicationName}`}
                value={group.applicationId ?? `name:${group.applicationName}`}
              >
                <Accordion.Control>
                  <Group justify="space-between" pr="md" wrap="nowrap">
                    <Text fw={700} lineClamp={1}>
                      {group.applicationName}
                    </Text>
                    <Badge variant="light">{group.tasks.length}</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      w="fit-content"
                      onClick={() => openCreateForApplication(group.applicationName)}
                    >
                      Создать задачу
                    </Button>

                    {group.tasks.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Нет задач, привязанных к этому приложению
                      </Text>
                    ) : (
                      <Stack gap={4}>
                        {group.tasks.map((task) => (
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
                            <Text fw={600} size="sm">
                              {task.taskShortLabel}
                            </Text>
                            {task.taskShortLabel !== task.taskName ? (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {task.taskName}
                              </Text>
                            ) : null}
                          </UnstyledButton>
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </FadeIn>
      ) : null}

      <CreateProjectModal
        opened={createOpened}
        initialApplication={createApplication}
        onClose={() => {
          setCreateOpened(false);
          setCreateApplication('');
        }}
        onCreated={() => {
          void reload();
          void navigate(AppRoutes.taskCurrent);
        }}
      />
    </Stack>
  );
}
