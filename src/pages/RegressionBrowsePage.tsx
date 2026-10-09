import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Tabs,
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
  loadRegressionCasesByModule,
  REGRESSION_MODE_LABELS,
  UNASSIGNED_MODULE,
  type RegressionCaseItem,
  type RegressionCasesByModule,
  type RegressionMode,
  type RegressionTaskGroup,
} from '@/application/regression/loadRegressionGroups';
import { regressionCaseMatches } from '@/application/regression/regressionSearch';
import { RegressionSearchField } from '@/components/testCases/RegressionSearchField';
import { FadeIn } from '@/components/ui/FadeIn';
import { AppRoutes, regressionModuleCasesPath, regressionTaskCasesPath } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUiStore } from '@/stores/useUiStore';

const MODULES_TAB = 'modules';
const UNASSIGNED_TAB = '__unassigned__';

const EMPTY_GROUPS: RegressionCasesByModule = { modules: [], unassigned: [] };
const EMPTY_EXPANDED: string[] = [];

function casesOf(tasks: RegressionTaskGroup[]): RegressionCaseItem[] {
  return tasks.flatMap((task) => task.cases);
}

function matchingCaseCount(cases: RegressionCaseItem[], query: string): number {
  return cases.filter((item) => regressionCaseMatches(item, query)).length;
}

function RegressionTaskLinks({
  tasks,
  query,
  onOpen,
}: {
  tasks: RegressionTaskGroup[];
  query: string;
  onOpen: (task: RegressionTaskGroup) => void;
}) {
  const visible = tasks
    .map((task) => ({ task, count: matchingCaseCount(task.cases, query) }))
    .filter((item) => item.count > 0);

  if (visible.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {query.trim() ? 'Ничего не найдено' : 'Нет задач'}
      </Text>
    );
  }

  return (
    <Stack gap="xs">
      {visible.map(({ task, count }) => (
        <UnstyledButton
          key={task.taskId}
          onClick={() => onOpen(task)}
          aria-label={`Открыть кейсы задачи ${task.taskShortLabel}`}
          style={{
            width: '100%',
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 'var(--mantine-radius-md)',
            padding: '10px 12px',
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text fw={600} lineClamp={1}>
                {task.taskShortLabel}
              </Text>
              {task.taskShortLabel !== task.taskName ? (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {task.taskName}
                </Text>
              ) : null}
            </div>
            <Badge variant="light">{count}</Badge>
          </Group>
        </UnstyledButton>
      ))}
    </Stack>
  );
}

export function RegressionBrowsePage() {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const mode: RegressionMode | null = isRegressionMode(modeParam) ? modeParam : null;
  const recentProjects = useAppStore((state) => state.recentProjects);
  const modules = useDirectoryStore((state) => state.modules);
  const isDirectoryLoaded = useDirectoryStore((state) => state.isLoaded);
  const loadDirectory = useDirectoryStore((state) => state.load);
  const current = useProjectStore((state) => state.current);
  const searchQuery = useUiStore((state) => state.regressionSearch);

  const [groups, setGroups] = useState<RegressionCasesByModule>(EMPTY_GROUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useUiStore((state) => (mode ? state.regressionListTab[mode] ?? null : null));
  const setRegressionListTab = useUiStore((state) => state.setRegressionListTab);
  const expandedModules = useUiStore((state) =>
    mode ? state.regressionExpandedModules[mode] ?? EMPTY_EXPANDED : EMPTY_EXPANDED,
  );
  const setRegressionExpandedModules = useUiStore((state) => state.setRegressionExpandedModules);

  const reload = useCallback(async () => {
    if (!mode) {
      setGroups(EMPTY_GROUPS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!useDirectoryStore.getState().isLoaded) {
        await loadDirectory();
      }
      setGroups(await loadRegressionCasesByModule(mode));
    } catch (loadError) {
      setGroups(EMPTY_GROUPS);
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
    modules,
    isDirectoryLoaded,
    current?.document.meta.id,
    current?.document.meta.module,
    current?.document.testCases,
  ]);

  useEffect(() => {
    if (!mode || loading || tab) {
      return;
    }
    setRegressionListTab(mode, groups.modules.length > 0 ? MODULES_TAB : UNASSIGNED_TAB);
  }, [groups.modules.length, loading, mode, setRegressionListTab, tab]);

  const rememberModule = (moduleName: string) => {
    if (!mode) {
      return;
    }
    setRegressionListTab(mode, MODULES_TAB);
    const openNames = useUiStore.getState().regressionExpandedModules[mode] ?? [];
    if (!openNames.includes(moduleName)) {
      setRegressionExpandedModules(mode, [...openNames, moduleName]);
    }
  };

  const openModuleCases = (moduleName: string) => {
    if (!mode) {
      return;
    }
    rememberModule(moduleName);
    void navigate(regressionModuleCasesPath(mode, moduleName));
  };

  const openTaskCases = (task: RegressionTaskGroup, moduleName: string | null) => {
    if (!mode) {
      return;
    }
    if (moduleName) {
      rememberModule(moduleName);
    } else {
      setRegressionListTab(mode, UNASSIGNED_TAB);
    }
    void navigate(regressionTaskCasesPath(mode, task.taskId));
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
  const checkboxLabel = mode === 'task' ? 'Добавить в регресс задачи?' : 'Добавить в регресс?';
  const hasCases =
    groups.modules.some((item) => casesOf(item.tasks).length > 0) ||
    casesOf(groups.unassigned).length > 0;
  const unassignedCount = matchingCaseCount(casesOf(groups.unassigned), searchQuery);
  const visibleModules = groups.modules.filter(
    (item) => matchingCaseCount(casesOf(item.tasks), searchQuery) > 0,
  );

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
              Кейсы с отметкой «{checkboxLabel}». Клик по модулю раскрывает задачи. Повторный клик
              открывает все кейсы модуля. Клик по задаче открывает её кейсы.
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

      {!loading && !hasCases ? (
        <Alert color="gray" title="Нет тест-кейсов">
          Нет кейсов для списка «{title}». Отметьте чекбокс в тест-кейсе. Модуль берётся из карточки
          задачи.
        </Alert>
      ) : null}

      {!loading && hasCases ? (
        <FadeIn>
          <Tabs
            value={tab ?? MODULES_TAB}
            onChange={(value) => {
              if (mode && value) {
                setRegressionListTab(mode, value);
              }
            }}
          >
            <Tabs.List>
              <Tabs.Tab value={MODULES_TAB}>Модули</Tabs.Tab>
              <Tabs.Tab value={UNASSIGNED_TAB}>
                <Group gap={8} wrap="nowrap">
                  <span>{UNASSIGNED_MODULE}</span>
                  <Badge variant="light" size="sm">
                    {unassignedCount}
                  </Badge>
                </Group>
              </Tabs.Tab>
            </Tabs.List>

            <Stack gap="md" mt="md">
              <Card withBorder padding="md" radius="lg">
                <RegressionSearchField />
              </Card>

              <Tabs.Panel value={MODULES_TAB}>
                {groups.modules.length === 0 ? (
                  <Alert color="gray">Нет задач с указанным модулем.</Alert>
                ) : visibleModules.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Ничего не найдено
                  </Text>
                ) : (
                  <Accordion
                    multiple
                    variant="separated"
                    radius="lg"
                    value={expandedModules}
                    onChange={(value) => {
                      const opened = value.filter((name) => !expandedModules.includes(name));
                      const closed = expandedModules.filter((name) => !value.includes(name));
                      const closing = closed.length === 1 && opened.length === 0 ? closed[0] : undefined;
                      if (closing) {
                        openModuleCases(closing);
                        return;
                      }
                      setRegressionExpandedModules(mode, value);
                    }}
                  >
                    {visibleModules.map((moduleGroup) => (
                      <Accordion.Item key={moduleGroup.moduleName} value={moduleGroup.moduleName}>
                        <Accordion.Control>
                          <Group justify="space-between" pr="md" wrap="nowrap">
                            <Text fw={700} lineClamp={1}>
                              {moduleGroup.moduleName}
                            </Text>
                            <Badge variant="light">
                              {matchingCaseCount(casesOf(moduleGroup.tasks), searchQuery)}
                            </Badge>
                          </Group>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <RegressionTaskLinks
                            tasks={moduleGroup.tasks}
                            query={searchQuery}
                            onOpen={(task) => openTaskCases(task, moduleGroup.moduleName)}
                          />
                        </Accordion.Panel>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                )}
              </Tabs.Panel>

              <Tabs.Panel value={UNASSIGNED_TAB}>
                <Card withBorder padding="md" radius="lg">
                  <RegressionTaskLinks
                    tasks={groups.unassigned}
                    query={searchQuery}
                    onOpen={(task) => openTaskCases(task, null)}
                  />
                </Card>
              </Tabs.Panel>
            </Stack>
          </Tabs>
        </FadeIn>
      ) : null}
    </Stack>
  );
}
