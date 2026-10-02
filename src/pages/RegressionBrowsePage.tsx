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
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { matchesDateFilter } from '@/application/testCases/datePresets';
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
import { projectActions } from '@/application/project/projectActions';
import { nextTestCaseNumber } from '@/application/testCases/renumberTestCases';
import { testCaseActions } from '@/application/testCases/testCaseActions';
import { DuplicateTestCaseModal } from '@/components/testCases/DuplicateTestCaseModal';
import { TestCaseDateFilter } from '@/components/testCases/TestCaseDateFilter';
import {
  TestCasesListTable,
  type TestCasesListRow,
} from '@/components/testCases/TestCasesListTable';
import { FadeIn } from '@/components/ui/FadeIn';
import type { TestResultOutcome } from '@/domain/types';
import { AppRoutes, testCaseEditorPath } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';
import { useUiStore } from '@/stores/useUiStore';

const MODULES_TAB = 'modules';
const UNASSIGNED_TAB = '__unassigned__';

const EMPTY_GROUPS: RegressionCasesByModule = { modules: [], unassigned: [] };
const EMPTY_EXPANDED: string[] = [];

type DateFilter = ReturnType<typeof useTestCaseTableStore.getState>['filters']['date'];
type RegressionListView = 'tasks' | 'cases';

function toDisplayRows(
  cases: RegressionCaseItem[],
  dateFilter: DateFilter,
  showSource: boolean,
): TestCasesListRow[] {
  return cases
    .filter((item) => {
      const dateValue = dateFilter.field === 'createdAt' ? item.createdAt : item.updatedAt;
      return matchesDateFilter(dateValue, dateFilter);
    })
    .map((item, index) => ({
      id: item.id,
      number: String(index + 1),
      title: item.title,
      goal: item.goal,
      includeInReport: item.includeInReport !== false,
      testOutcome: item.testOutcome,
      sourceLabel: showSource
        ? item.taskShortLabel !== item.taskName
          ? `${item.taskShortLabel} — ${item.taskName}`
          : item.taskShortLabel
        : undefined,
    }));
}

function casesOf(tasks: RegressionTaskGroup[]): RegressionCaseItem[] {
  return tasks.flatMap((task) => task.cases);
}

type CaseListHandlers = {
  onOpen: (row: TestCasesListRow, view: RegressionListView) => void;
  onDuplicate: (row: TestCasesListRow, view: RegressionListView) => void;
  onDelete: (row: TestCasesListRow) => void;
  onOutcomeChange: (row: TestCasesListRow, outcome: TestResultOutcome) => void;
  onIncludeInReportChange: (row: TestCasesListRow, includeInReport: boolean) => void;
  openingId: string | null;
  deletingId: string | null;
  duplicatingId: string | null;
};

function RegressionTaskList({
  tasks,
  dateFilter,
  expandedTasks,
  onExpandedTasksChange,
  handlers,
  rowKeyPrefix,
  emptyText,
}: {
  tasks: RegressionTaskGroup[];
  dateFilter: DateFilter;
  expandedTasks: string[];
  onExpandedTasksChange: (ids: string[]) => void;
  handlers: CaseListHandlers;
  rowKeyPrefix: string;
  emptyText: string;
}) {
  const visible = tasks
    .map((task) => ({ task, rows: toDisplayRows(task.cases, dateFilter, false) }))
    .filter((item) => item.rows.length > 0);

  if (visible.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {emptyText}
      </Text>
    );
  }

  return (
    <Accordion
      multiple
      variant="contained"
      radius="md"
      value={expandedTasks}
      onChange={onExpandedTasksChange}
    >
      {visible.map(({ task, rows }) => (
        <Accordion.Item key={`${rowKeyPrefix}${task.taskId}`} value={task.taskId}>
          <Accordion.Control>
            <Group justify="space-between" pr="md" wrap="nowrap">
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
              <Badge variant="light">{rows.length}</Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <TestCasesListTable
              rows={rows}
              onOpen={(row) => handlers.onOpen(row, 'tasks')}
              onDuplicate={(row) => handlers.onDuplicate(row, 'tasks')}
              onDelete={handlers.onDelete}
              onOutcomeChange={handlers.onOutcomeChange}
              onIncludeInReportChange={handlers.onIncludeInReportChange}
              openingId={handlers.openingId}
              deletingId={handlers.deletingId}
              duplicatingId={handlers.duplicatingId}
              emptyText={emptyText}
              rowKeyPrefix={`${rowKeyPrefix}${task.taskId}`}
            />
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
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
  const dateFilter = useTestCaseTableStore((state) => state.filters.date);

  const [groups, setGroups] = useState<RegressionCasesByModule>(EMPTY_GROUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tab = useUiStore((state) => (mode ? state.regressionListTab[mode] ?? null : null));
  const setRegressionListTab = useUiStore((state) => state.setRegressionListTab);
  const expandedModules = useUiStore((state) =>
    mode ? state.regressionExpandedModules[mode] ?? EMPTY_EXPANDED : EMPTY_EXPANDED,
  );
  const setRegressionExpandedModules = useUiStore((state) => state.setRegressionExpandedModules);
  const flatModules = useUiStore((state) =>
    mode ? state.regressionFlatModules[mode] ?? EMPTY_EXPANDED : EMPTY_EXPANDED,
  );
  const setRegressionFlatModules = useUiStore((state) => state.setRegressionFlatModules);
  const expandedTasks = useUiStore((state) =>
    mode ? state.regressionExpandedTasks[mode] ?? EMPTY_EXPANDED : EMPTY_EXPANDED,
  );
  const setRegressionExpandedTasks = useUiStore((state) => state.setRegressionExpandedTasks);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<RegressionCaseItem | null>(null);
  const [duplicateView, setDuplicateView] = useState<RegressionListView>('tasks');
  const [duplicateSuggestedNumber, setDuplicateSuggestedNumber] = useState('1');

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

  const rememberList = (item: RegressionCaseItem, view: RegressionListView) => {
    if (!mode) {
      return;
    }
    const state = useUiStore.getState();
    if (item.module === UNASSIGNED_MODULE) {
      setRegressionListTab(mode, UNASSIGNED_TAB);
    } else {
      setRegressionListTab(mode, MODULES_TAB);
      const openNames = state.regressionExpandedModules[mode] ?? [];
      if (!openNames.includes(item.module)) {
        setRegressionExpandedModules(mode, [...openNames, item.module]);
      }
      const flat = state.regressionFlatModules[mode] ?? [];
      if (view === 'cases') {
        if (!flat.includes(item.module)) {
          setRegressionFlatModules(mode, [...flat, item.module]);
        }
      } else if (flat.includes(item.module)) {
        setRegressionFlatModules(
          mode,
          flat.filter((name) => name !== item.module),
        );
      }
    }
    if (view === 'tasks') {
      const openTasks = state.regressionExpandedTasks[mode] ?? [];
      if (!openTasks.includes(item.taskId)) {
        setRegressionExpandedTasks(mode, [...openTasks, item.taskId]);
      }
    }
  };

  const caseById = useMemo(() => {
    const map = new Map<string, RegressionCaseItem>();
    for (const item of [
      ...groups.modules.flatMap((moduleGroup) => casesOf(moduleGroup.tasks)),
      ...casesOf(groups.unassigned),
    ]) {
      map.set(item.id, item);
    }
    return map;
  }, [groups]);

  const ensureTaskOpen = async (item: RegressionCaseItem): Promise<boolean> => {
    const open = useProjectStore.getState().current;
    const sameTask =
      Boolean(open) &&
      ((item.taskFilePath && open?.filePath === item.taskFilePath) ||
        open?.document.meta.id === item.taskId);

    if (sameTask) {
      return true;
    }

    if (!item.taskFilePath || item.taskFilePath.startsWith('__unsaved__')) {
      setError('Файл задачи не сохранён — откройте задачу вручную.');
      return false;
    }

    return projectActions.openRecent(item.taskFilePath, {
      preserveRecentOrder: true,
    });
  };

  const openCase = async (row: TestCasesListRow, view: RegressionListView) => {
    if (!mode) {
      return;
    }
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
    rememberList(item, view);
    setOpeningId(row.id);
    try {
      const ok = await ensureTaskOpen(item);
      if (!ok) {
        return;
      }
      void navigate(testCaseEditorPath(row.id), { state: { from: 'regression', mode } });
    } finally {
      setOpeningId(null);
    }
  };

  const deleteCase = async (row: TestCasesListRow) => {
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
    setDeletingId(row.id);
    try {
      const ok = await ensureTaskOpen(item);
      if (!ok) {
        return;
      }
      const removed = await testCaseActions.remove([row.id]);
      if (removed && item.taskFilePath) {
        await projectActions.save();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openDuplicate = async (row: TestCasesListRow, view: RegressionListView) => {
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
    setDuplicateView(view);
    setDuplicatingId(row.id);
    try {
      const ok = await ensureTaskOpen(item);
      if (!ok) {
        return;
      }
      const open = useProjectStore.getState().current;
      setDuplicateSuggestedNumber(nextTestCaseNumber(open?.document.testCases ?? []));
      setDuplicateSource(item);
    } finally {
      setDuplicatingId(null);
    }
  };

  const changeOutcome = async (row: TestCasesListRow, outcome: TestResultOutcome) => {
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
    const ok = await ensureTaskOpen(item);
    if (!ok) {
      return;
    }
    const updated = testCaseActions.setOutcome(row.id, outcome);
    if (updated && item.taskFilePath) {
      await projectActions.save();
    }
  };

  const changeIncludeInReport = async (row: TestCasesListRow, includeInReport: boolean) => {
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
    const ok = await ensureTaskOpen(item);
    if (!ok) {
      return;
    }
    const updated = testCaseActions.setIncludeInReport(row.id, includeInReport);
    if (updated && item.taskFilePath) {
      await projectActions.save();
    }
  };

  const listHandlers: CaseListHandlers = {
    onOpen: (row, view) => {
      void openCase(row, view);
    },
    onDuplicate: (row, view) => {
      void openDuplicate(row, view);
    },
    onDelete: (row) => {
      void deleteCase(row);
    },
    onOutcomeChange: (row, outcome) => {
      void changeOutcome(row, outcome);
    },
    onIncludeInReportChange: (row, includeInReport) => {
      void changeIncludeInReport(row, includeInReport);
    },
    openingId,
    deletingId,
    duplicatingId,
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
  const unassignedCount = casesOf(groups.unassigned).length;
  const duplicateLabel =
    duplicateSource?.goal?.plainText?.trim() || duplicateSource?.title?.trim() || '';

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
              Кейсы с отметкой «{checkboxLabel}». Под модулем — задачи, у задачи — её кейсы.
              Повторный клик по модулю показывает все кейсы модуля.
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
                <TestCaseDateFilter />
              </Card>

              <Tabs.Panel value={MODULES_TAB}>
                {groups.modules.length === 0 ? (
                  <Alert color="gray">Нет задач с указанным модулем.</Alert>
                ) : (
                  <Accordion
                    multiple
                    variant="separated"
                    radius="lg"
                    value={expandedModules}
                    onChange={(value) => {
                      if (!mode) {
                        return;
                      }
                      const opened = value.filter((name) => !expandedModules.includes(name));
                      const closed = expandedModules.filter((name) => !value.includes(name));
                      const closing = closed.length === 1 ? closed[0] : undefined;
                      if (closing && opened.length === 0 && !flatModules.includes(closing)) {
                        setRegressionFlatModules(mode, [...flatModules, closing]);
                        return;
                      }
                      if (opened.length > 0) {
                        setRegressionFlatModules(
                          mode,
                          flatModules.filter((name) => !opened.includes(name)),
                        );
                      }
                      if (closed.length > 0) {
                        setRegressionFlatModules(
                          mode,
                          flatModules.filter((name) => !closed.includes(name)),
                        );
                      }
                      setRegressionExpandedModules(mode, value);
                    }}
                  >
                    {groups.modules.map((moduleGroup) => {
                      const moduleCases = casesOf(moduleGroup.tasks);
                      const showAllCases = flatModules.includes(moduleGroup.moduleName);
                      return (
                        <Accordion.Item key={moduleGroup.moduleName} value={moduleGroup.moduleName}>
                          <Accordion.Control>
                            <Group justify="space-between" pr="md" wrap="nowrap">
                              <Text fw={700} lineClamp={1}>
                                {moduleGroup.moduleName}
                              </Text>
                              <Group gap={8} wrap="nowrap">
                                {showAllCases ? (
                                  <Badge variant="outline">Все кейсы</Badge>
                                ) : null}
                                <Badge variant="light">{moduleCases.length}</Badge>
                              </Group>
                            </Group>
                          </Accordion.Control>
                          <Accordion.Panel>
                            {showAllCases ? (
                              <TestCasesListTable
                                rows={toDisplayRows(moduleCases, dateFilter, true)}
                                onOpen={(row) => void openCase(row, 'cases')}
                                onDuplicate={(row) => void openDuplicate(row, 'cases')}
                                onDelete={(row) => void deleteCase(row)}
                                onOutcomeChange={(row, outcome) => void changeOutcome(row, outcome)}
                                onIncludeInReportChange={(row, includeInReport) =>
                                  void changeIncludeInReport(row, includeInReport)
                                }
                                openingId={openingId}
                                deletingId={deletingId}
                                duplicatingId={duplicatingId}
                                emptyText="Нет кейсов для этого модуля по текущим фильтрам"
                                rowKeyPrefix={moduleGroup.moduleName}
                              />
                            ) : (
                              <RegressionTaskList
                                tasks={moduleGroup.tasks}
                                dateFilter={dateFilter}
                                expandedTasks={expandedTasks}
                                onExpandedTasksChange={(ids) => {
                                  if (mode) {
                                    setRegressionExpandedTasks(mode, ids);
                                  }
                                }}
                                handlers={listHandlers}
                                rowKeyPrefix={moduleGroup.moduleName}
                                emptyText="Нет кейсов для этого модуля по текущим фильтрам"
                              />
                            )}
                          </Accordion.Panel>
                        </Accordion.Item>
                      );
                    })}
                  </Accordion>
                )}
              </Tabs.Panel>

              <Tabs.Panel value={UNASSIGNED_TAB}>
                <Card withBorder padding="md" radius="lg">
                  <RegressionTaskList
                    tasks={groups.unassigned}
                    dateFilter={dateFilter}
                    expandedTasks={expandedTasks}
                    onExpandedTasksChange={(ids) => {
                      if (mode) {
                        setRegressionExpandedTasks(mode, ids);
                      }
                    }}
                    handlers={listHandlers}
                    rowKeyPrefix="unassigned"
                    emptyText="Нет кейсов у задач без модуля"
                  />
                </Card>
              </Tabs.Panel>
            </Stack>
          </Tabs>
        </FadeIn>
      ) : null}

      <DuplicateTestCaseModal
        opened={Boolean(duplicateSource)}
        sourceNumber={duplicateSource?.number}
        sourceLabel={duplicateLabel}
        suggestedNumber={duplicateSuggestedNumber}
        onClose={() => setDuplicateSource(null)}
        onConfirm={(number) => {
          if (!duplicateSource || !mode) {
            return;
          }
          rememberList(duplicateSource, duplicateView);
          const created = testCaseActions.duplicate(duplicateSource.id, number);
          setDuplicateSource(null);
          if (created) {
            void navigate(testCaseEditorPath(created.id), { state: { from: 'regression', mode } });
          }
        }}
      />
    </Stack>
  );
}
