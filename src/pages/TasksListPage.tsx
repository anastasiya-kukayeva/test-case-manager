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
  IconDeviceFloppy,
  IconFolderOpen,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { confirmAction } from '@/application/ui/confirmAction';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { FadeIn } from '@/components/ui/FadeIn';
import type { RecentTask } from '@/domain/types';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

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
  const reduceMotion = useReducedMotion();

  const showUnsaved =
    Boolean(current && !current.filePath) &&
    matchesTaskQuery(searchQuery, {
      name: current!.document.meta.name,
      shortName: current!.document.meta.shortName,
      filePath: '',
    });

  const filteredProjects = useMemo(
    () => recentProjects.filter((task: RecentTask) => matchesTaskQuery(searchQuery, task)),
    [recentProjects, searchQuery],
  );

  const listEmpty = recentProjects.length === 0 && !(current && !current.filePath);
  const noMatches = !listEmpty && !showUnsaved && filteredProjects.length === 0;

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
    if (!filePath || filePath.startsWith('__unsaved__')) {
      void navigate(AppRoutes.taskCurrent);
      return;
    }
    const ok = await projectActions.openRecent(filePath, { preserveRecentOrder: true });
    if (ok) {
      void navigate(AppRoutes.taskCurrent);
    }
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
                  </motion.div>
                ) : null}

                {filteredProjects.map((task) => {
                  const isCurrent =
                    Boolean(current?.filePath && current.filePath === task.filePath) ||
                    current?.document.meta.id === task.id;

                  return (
                    <motion.div
                      key={`${task.id}-${task.filePath}`}
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
                          background: isCurrent
                            ? 'var(--mantine-color-blue-light)'
                            : undefined,
                        }}
                        className="tcm-task-list-row"
                        onClick={() => void openTask(task.filePath)}
                      >
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} truncate>
                            {getTaskShortLabel(task)}
                          </Text>
                          <Text size="xs" c="dimmed" truncate>
                            {task.filePath}
                          </Text>
                        </div>
                        <Group gap="xs" wrap="nowrap">
                          <Text size="xs" c="dimmed">
                            {dayjs(task.openedAt).format('DD.MM.YYYY HH:mm')}
                          </Text>
                          <Tooltip label="Убрать из списка">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="Remove recent"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRemoveRecent(task.filePath, task.name);
                              }}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                    </motion.div>
                  );
                })}
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
    </Stack>
  );
}
