import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconFileExport,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportActions } from '@/application/export/exportActions';
import {
  loadPsiExportGroups,
  type PsiExportModuleGroup,
  type PsiExportTask,
} from '@/application/export/loadPsiExportGroups';
import { FadeIn } from '@/components/ui/FadeIn';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

function taskMatches(task: PsiExportTask, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (!needle) {
    return true;
  }
  return [task.taskName, task.taskShortLabel].some((value) =>
    value.toLocaleLowerCase('ru').includes(needle),
  );
}

export function PsiExportPage() {
  const navigate = useNavigate();
  const recentProjects = useAppStore((state) => state.recentProjects);
  const modules = useDirectoryStore((state) => state.modules);
  const isDirectoryLoaded = useDirectoryStore((state) => state.isLoaded);
  const loadDirectory = useDirectoryStore((state) => state.load);
  const current = useProjectStore((state) => state.current);

  const [groups, setGroups] = useState<PsiExportModuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!useDirectoryStore.getState().isLoaded) {
        await loadDirectory();
      }
      const next = await loadPsiExportGroups();
      setGroups(next);
      const known = new Set(next.flatMap((group) => group.tasks.map((task) => task.taskId)));
      setSelectedIds((currentIds) => new Set([...currentIds].filter((id) => known.has(id))));
    } catch (loadError) {
      setGroups([]);
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить задачи ПСИ');
    } finally {
      setLoading(false);
    }
  }, [loadDirectory]);

  useEffect(() => {
    void reload();
  }, [
    reload,
    recentProjects,
    modules,
    isDirectoryLoaded,
    current?.document.meta.id,
    current?.document.meta.module,
    current?.document.meta.templateId,
    current?.document.testCases,
  ]);

  const visibleGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          tasks: group.tasks.filter((task) => taskMatches(task, query)),
        }))
        .filter((group) => group.tasks.length > 0),
    [groups, query],
  );

  const selectedCount = selectedIds.size;

  const toggleTask = (taskId: string) => {
    setSelectedIds((currentIds) => {
      const next = new Set(currentIds);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleModule = (tasks: PsiExportTask[], checked: boolean) => {
    setSelectedIds((currentIds) => {
      const next = new Set(currentIds);
      for (const task of tasks) {
        if (checked) {
          next.add(task.taskId);
        } else {
          next.delete(task.taskId);
        }
      }
      return next;
    });
  };

  const exportSelected = async () => {
    const selectedGroups = groups
      .map((group) => ({
        moduleName: group.moduleName,
        documents: group.tasks
          .filter((task) => selectedIds.has(task.taskId))
          .map((task) => task.document),
      }))
      .filter((group) => group.documents.length > 0);
    if (selectedGroups.length === 0) {
      return;
    }
    setExporting(true);
    try {
      await exportActions.exportPsiTasksDocx(selectedGroups);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack gap="lg" style={{ minHeight: 'calc(100dvh - 56px - 36px - 2rem)' }}>
      <Button
        variant="subtle"
        w="fit-content"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => void navigate(AppRoutes.tasks)}
      >
        Назад к задачам
      </Button>

      <FadeIn>
        <Title order={2}>Выгрузка ПСИ</Title>
        <Text c="dimmed" mt="xs">
          Отметьте задачи. В Word они соберутся по модулям: каждый модуль с нового листа, затем его тест-кейсы.
        </Text>
      </FadeIn>

      <TextInput
        placeholder="Поиск по названию…"
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(event) => {
          setQuery(event.currentTarget?.value ?? event.target?.value ?? '');
        }}
        rightSection={
          query.trim() ? (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Очистить поиск"
              onClick={() => setQuery('')}
            >
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
      />

      {error ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Не удалось загрузить задачи">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Читаем задачи…
          </Text>
        </Group>
      ) : null}

      {!loading && !error && groups.length === 0 ? (
        <Text c="dimmed" size="sm">
          Нет задач ПСИ среди недавно открытых.
        </Text>
      ) : null}

      {!loading && !error && groups.length > 0 && visibleGroups.length === 0 ? (
        <Text c="dimmed" size="sm">
          Ничего не найдено
        </Text>
      ) : null}

      <Stack gap="sm">
        {visibleGroups.map((group) => {
          const source = groups.find((item) => item.moduleName === group.moduleName) ?? group;
          const selectedInGroup = source.tasks.filter((task) =>
            selectedIds.has(task.taskId),
          ).length;
          const allChecked = source.tasks.length > 0 && selectedInGroup === source.tasks.length;
          const someChecked = selectedInGroup > 0 && !allChecked;
          return (
            <Card key={group.moduleName} withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    label={<Text fw={600}>{group.moduleName}</Text>}
                    onChange={(event) => toggleModule(source.tasks, event.currentTarget.checked)}
                  />
                  <Text size="sm" c="dimmed">
                    {selectedInGroup} из {source.tasks.length}
                  </Text>
                </Group>
                <Stack gap="xs">
                  {group.tasks.map((task) => (
                    <Group key={task.taskId} wrap="nowrap" gap="sm" align="flex-start">
                      <Checkbox
                        mt={2}
                        checked={selectedIds.has(task.taskId)}
                        aria-label={task.taskShortLabel}
                        onChange={() => toggleTask(task.taskId)}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={600} lineClamp={1}>
                          {task.taskShortLabel}
                        </Text>
                        {task.taskShortLabel !== task.taskName ? (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {task.taskName}
                          </Text>
                        ) : null}
                      </div>
                      <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                        {task.releaseNumber || '—'}
                      </Text>
                      <Badge variant="light" style={{ flexShrink: 0 }}>
                        {task.caseCount}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Card>
          );
        })}
      </Stack>

      <Group
        justify="space-between"
        mt="auto"
        py="sm"
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Text size="sm">Выбрано задач: {selectedCount}</Text>
        <Button
          leftSection={<IconFileExport size={16} />}
          disabled={selectedCount === 0}
          loading={exporting}
          onClick={() => void exportSelected()}
        >
          Выгрузить в Word
        </Button>
      </Group>
    </Stack>
  );
}
