import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconFileImport, IconFileWord, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { exportActions } from '@/application/export/exportActions';
import {
  regressionReportImportActions,
  type RegressionImportTaskRef,
} from '@/application/import/regressionReportImportActions';
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
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { regressionBrowsePath, testCaseEditorPath } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';

const EMPTY_GROUPS: RegressionCasesByModule = { modules: [], unassigned: [] };

function decodeScopeId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function casesOf(tasks: RegressionTaskGroup[]): RegressionCaseItem[] {
  return tasks.flatMap((task) => task.cases);
}

function toDisplayRows(cases: RegressionCaseItem[], showSource: boolean): TestCasesListRow[] {
  const dateFilter = useTestCaseTableStore.getState().filters.date;
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
      includeInRegression: item.includeInRegression,
      includeInTaskRegression: item.includeInTaskRegression,
      testOutcome: item.testOutcome,
      sourceLabel: showSource
        ? item.taskShortLabel !== item.taskName
          ? `${item.taskShortLabel} — ${item.taskName}`
          : item.taskShortLabel
        : undefined,
    }));
}

export function RegressionScopeCasesPage() {
  const { mode: modeParam, scope, scopeId: scopeIdParam } = useParams<{
    mode: string;
    scope: string;
    scopeId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const mode: RegressionMode | null = isRegressionMode(modeParam) ? modeParam : null;
  const scopeId = scopeIdParam ? decodeScopeId(scopeIdParam) : '';
  const isModule = scope === 'module';
  const isTask = scope === 'task';
  const recentProjects = useAppStore((state) => state.recentProjects);
  const modules = useDirectoryStore((state) => state.modules);
  const isDirectoryLoaded = useDirectoryStore((state) => state.isLoaded);
  const loadDirectory = useDirectoryStore((state) => state.load);
  const current = useProjectStore((state) => state.current);
  const dateFilter = useTestCaseTableStore((state) => state.filters.date);

  const [groups, setGroups] = useState<RegressionCasesByModule>(EMPTY_GROUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<RegressionCaseItem | null>(null);
  const [duplicateSuggestedNumber, setDuplicateSuggestedNumber] = useState('1');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!mode) {
      setGroups(EMPTY_GROUPS);
      setLoading(false);
      return;
    }
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      if (!useDirectoryStore.getState().isLoaded) {
        await loadDirectory();
      }
      setGroups(await loadRegressionCasesByModule(mode));
      hasLoadedRef.current = true;
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

  const selection = useMemo(() => {
    if (isModule) {
      const moduleGroup = groups.modules.find(
        (item) => item.moduleName.toLocaleLowerCase('ru') === scopeId.toLocaleLowerCase('ru'),
      );
      return {
        title: moduleGroup?.moduleName || scopeId || 'Модуль',
        subtitle: 'Все кейсы модуля',
        moduleName: moduleGroup?.moduleName || scopeId,
        cases: moduleGroup ? casesOf(moduleGroup.tasks) : [],
        found: Boolean(moduleGroup),
        showSource: true,
      };
    }
    if (isTask) {
      const task = [...groups.modules.flatMap((item) => item.tasks), ...groups.unassigned].find(
        (item) => item.taskId === scopeId,
      );
      const taskModule = groups.modules.find((item) =>
        item.tasks.some((entry) => entry.taskId === scopeId),
      );
      return {
        title: task?.taskShortLabel || 'Задача',
        subtitle: task && task.taskShortLabel !== task.taskName ? task.taskName : 'Кейсы задачи',
        moduleName: taskModule?.moduleName ?? '',
        cases: task?.cases ?? [],
        found: Boolean(task),
        showSource: false,
      };
    }
    return {
      title: 'Список',
      subtitle: '',
      moduleName: '',
      cases: [] as RegressionCaseItem[],
      found: false,
      showSource: false,
    };
  }, [groups, isModule, isTask, scopeId]);

  const rows = useMemo(
    () => toDisplayRows(selection.cases, selection.showSource),
    [selection.cases, selection.showSource, dateFilter],
  );

  const caseById = useMemo(() => {
    const map = new Map<string, RegressionCaseItem>();
    for (const item of selection.cases) {
      map.set(item.id, item);
    }
    return map;
  }, [selection.cases]);

  const taskRefFromGroup = (task: RegressionTaskGroup): RegressionImportTaskRef => {
    const first = task.cases[0];
    return {
      taskId: task.taskId,
      taskShortLabel: task.taskShortLabel,
      taskFilePath: task.taskFilePath,
      application: first?.application ?? '',
      module: first && first.module !== UNASSIGNED_MODULE ? first.module : '',
    };
  };

  const importTargets = (): RegressionImportTaskRef[] => {
    if (isTask) {
      const task = [...groups.modules.flatMap((item) => item.tasks), ...groups.unassigned].find(
        (item) => item.taskId === scopeId,
      );
      if (task) {
        return [taskRefFromGroup(task)];
      }
      if (current?.document.meta.id === scopeId) {
        return [
          {
            taskId: current.document.meta.id,
            taskShortLabel: getTaskShortLabel(current.document.meta),
            taskFilePath: current.filePath,
            application: current.document.meta.application?.trim() ?? '',
            module: current.document.meta.module?.trim() ?? '',
          },
        ];
      }
      const recent = recentProjects.find((item) => item.id === scopeId);
      if (recent?.filePath) {
        return [
          {
            taskId: recent.id,
            taskShortLabel: getTaskShortLabel(recent),
            taskFilePath: recent.filePath,
            application: '',
            module: '',
          },
        ];
      }
      return [];
    }
    if (isModule) {
      const moduleGroup = groups.modules.find(
        (item) => item.moduleName.toLocaleLowerCase('ru') === scopeId.toLocaleLowerCase('ru'),
      );
      return moduleGroup ? moduleGroup.tasks.map(taskRefFromGroup) : [];
    }
    return [];
  };

  const importReport = async () => {
    if (!mode) {
      return;
    }
    setImporting(true);
    try {
      const imported = await regressionReportImportActions.importReport({
        mode,
        singleTask: isTask,
        tasks: importTargets(),
      });
      if (imported) {
        await reload();
      }
    } finally {
      setImporting(false);
    }
  };

  const exportReport = async () => {
    if (!useDirectoryStore.getState().isLoaded) {
      await loadDirectory();
    }
    const directory = useDirectoryStore.getState();
    const author = directory.people.find((person) => person.role === 'author' && person.isDefault);
    const environment = directory.environments.find((item) => item.isDefault);
    setExporting(true);
    try {
      const included = selection.cases.filter((item) => item.includeInReport !== false);
      const namedCases = included.length > 0 ? included : selection.cases;
      const taskShortNames: string[] = [];
      const seenTaskNames = new Set<string>();
      for (const item of namedCases) {
        const name = item.taskShortLabel.trim();
        const key = name.toLocaleLowerCase('ru');
        if (!name || seenTaskNames.has(key)) {
          continue;
        }
        seenTaskNames.add(key);
        taskShortNames.push(name);
      }
      await exportActions.exportRegressionReport({
        moduleName: selection.moduleName,
        taskShortName: taskShortNames.join(', ') || selection.title,
        authorName: author?.name ?? '',
        environmentName: environment?.name ?? '',
        cases: selection.cases
          .filter((item) => item.includeInReport !== false)
          .map((item) => ({
            applicationName: item.application,
            moduleName: item.module === UNASSIGNED_MODULE ? '' : item.module,
            text: item.goal?.plainText?.trim() || '',
          })),
      });
    } finally {
      setExporting(false);
    }
  };

  const back = () => {
    if (mode) {
      void navigate(regressionBrowsePath(mode));
    }
  };

  const editorState = (caseMode: RegressionMode) => ({
    from: 'regression' as const,
    mode: caseMode,
    returnTo: location.pathname,
  });

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

  const openCase = async (row: TestCasesListRow) => {
    if (!mode) {
      return;
    }
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
    setOpeningId(row.id);
    try {
      const ok = await ensureTaskOpen(item);
      if (!ok) {
        return;
      }
      void navigate(testCaseEditorPath(row.id), { state: editorState(mode) });
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

  const openDuplicate = async (row: TestCasesListRow) => {
    const item = caseById.get(row.id);
    if (!item) {
      return;
    }
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

  const changeRegression = async (
    row: TestCasesListRow,
    patch: { includeInRegression?: boolean; includeInTaskRegression?: boolean },
  ) => {
    const item = caseById.get(row.id);
    if (!item || !mode) {
      return;
    }
    const ok = await ensureTaskOpen(item);
    if (!ok) {
      return;
    }
    const updated = testCaseActions.setRegressionFlags(row.id, patch);
    if (!updated) {
      return;
    }
    const nextRegression = patch.includeInRegression ?? item.includeInRegression;
    const nextTaskRegression = patch.includeInTaskRegression ?? item.includeInTaskRegression;
    const stays = mode === 'task' ? nextTaskRegression : nextRegression;
    const applyCase = (entry: RegressionCaseItem): RegressionCaseItem | null => {
      if (entry.id !== row.id) {
        return entry;
      }
      if (!stays) {
        return null;
      }
      return {
        ...entry,
        includeInRegression: nextRegression,
        includeInTaskRegression: nextTaskRegression,
      };
    };
    const applyTasks = (tasks: RegressionTaskGroup[]) =>
      tasks
        .map((task) => ({
          ...task,
          cases: task.cases.flatMap((entry) => {
            const next = applyCase(entry);
            return next ? [next] : [];
          }),
        }))
        .filter((task) => task.cases.length > 0);
    setGroups((current) => ({
      modules: current.modules.map((moduleGroup) => ({
        ...moduleGroup,
        tasks: applyTasks(moduleGroup.tasks),
      })),
      unassigned: applyTasks(current.unassigned),
    }));
    if (item.taskFilePath) {
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

  if (!mode || (!isModule && !isTask)) {
    return (
      <Stack gap="md">
        <Alert color="yellow" title="Неизвестный список">
          Вернитесь к выбору регресса.
        </Alert>
        <Button w="fit-content" onClick={() => void navigate('/regression')}>
          К регрессу
        </Button>
      </Stack>
    );
  }

  const title = REGRESSION_MODE_LABELS[mode];
  const checkboxLabel = mode === 'task' ? 'Добавить в регресс задачи?' : 'Добавить в регресс?';
  const duplicateLabel =
    duplicateSource?.goal?.plainText?.trim() || duplicateSource?.title?.trim() || '';

  return (
    <Stack gap="lg">
      <Button
        variant="subtle"
        w="fit-content"
        leftSection={<IconArrowLeft size={16} />}
        onClick={back}
      >
        К списку регресса
      </Button>

      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>{selection.title}</Title>
            <Text c="dimmed" mt="xs">
              {title}
              {selection.subtitle ? ` · ${selection.subtitle}` : ''}
              {' · '}
              кейсы с отметкой «{checkboxLabel}»
            </Text>
          </div>
          <Group gap="xs">
            <Button
              size="sm"
              variant="light"
              loading={importing}
              leftSection={<IconFileImport size={14} />}
              onClick={() => void importReport()}
            >
              Импорт отчета из Word
            </Button>
            <Button
              size="sm"
              variant="light"
              loading={exporting}
              leftSection={<IconFileWord size={14} />}
              onClick={() => void exportReport()}
            >
              Экспорт отчета в Word
            </Button>
            <Tooltip label="Обновить">
              <ActionIcon variant="default" onClick={() => void reload()} loading={loading}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
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

      {!loading && !selection.found ? (
        <Alert color="gray" title="Список не найден">
          {isModule ? 'Модуль не найден в этом регрессе.' : 'Задача не найдена в этом регрессе.'}
        </Alert>
      ) : null}

      {!loading && selection.found ? (
        <>
          <Card withBorder padding="md" radius="lg">
            <TestCaseDateFilter />
          </Card>
          <Card withBorder padding="md" radius="lg">
            <TestCasesListTable
              rows={rows}
              onOpen={(row) => void openCase(row)}
              onDuplicate={(row) => void openDuplicate(row)}
              onDelete={(row) => void deleteCase(row)}
              onOutcomeChange={(row, outcome) => void changeOutcome(row, outcome)}
              onIncludeInReportChange={(row, includeInReport) =>
                void changeIncludeInReport(row, includeInReport)
              }
              onRegressionChange={(row, patch) => void changeRegression(row, patch)}
              openingId={openingId}
              deletingId={deletingId}
              duplicatingId={duplicatingId}
              emptyText="Нет кейсов по текущим фильтрам"
            />
          </Card>
        </>
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
          const created = testCaseActions.duplicate(duplicateSource.id, number);
          setDuplicateSource(null);
          if (created) {
            void navigate(testCaseEditorPath(created.id), { state: editorState(mode) });
          }
        }}
      />
    </Stack>
  );
}
