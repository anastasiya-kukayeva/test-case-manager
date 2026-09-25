import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Card,
  Collapse,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconClipboardList,
  IconRefresh,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loadCatalogTestCaseGroups,
  type CatalogTaskGroup,
  type CatalogTestCaseRow,
} from '@/application/testCases/loadCatalogTestCases';
import { nextTestCaseNumber } from '@/application/testCases/renumberTestCases';
import { testCaseActions } from '@/application/testCases/testCaseActions';
import { projectActions } from '@/application/project/projectActions';
import { DuplicateTestCaseModal } from '@/components/testCases/DuplicateTestCaseModal';
import { ImportWordTestCasesButton } from '@/components/testCases/ImportWordTestCasesButton';
import { TestCasesListTable } from '@/components/testCases/TestCasesListTable';
import { FadeIn } from '@/components/ui/FadeIn';
import type { TestResultOutcome } from '@/domain/types';
import { AppRoutes, testCaseEditorPath } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

function findCase(group: CatalogTaskGroup, id: string): CatalogTestCaseRow | undefined {
  return group.testCases.find((item) => item.id === id);
}

function matchesCaseQuery(row: CatalogTestCaseRow, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (!needle) {
    return true;
  }
  const haystacks = [
    row.number,
    row.title,
    row.goal?.plainText ?? '',
    row.taskName,
    row.taskShortLabel,
  ];
  return haystacks.some((value) => value.toLocaleLowerCase('ru').includes(needle));
}

export function AllTestCasesPage() {
  const navigate = useNavigate();
  const recentProjects = useAppStore((state) => state.recentProjects);
  const current = useProjectStore((state) => state.current);
  const [groups, setGroups] = useState<CatalogTaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<CatalogTestCaseRow | null>(null);
  const [duplicateSuggestedNumber, setDuplicateSuggestedNumber] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadCatalogTestCaseGroups();
      setGroups(next);
      setExpandedIds((currentIds) => {
        const valid = new Set(next.map((group) => group.taskId));
        return currentIds.filter((id) => valid.has(id));
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить тест-кейсы');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, recentProjects, current?.document.meta.id, current?.document.testCases.length]);

  const toggleGroup = (taskId: string) => {
    setExpandedIds((currentIds) =>
      currentIds.includes(taskId)
        ? currentIds.filter((id) => id !== taskId)
        : [...currentIds, taskId],
    );
  };

  const ensureTaskOpen = async (task: {
    taskId: string;
    taskFilePath: string | null;
  }): Promise<boolean> => {
    const open = useProjectStore.getState().current;
    const sameTask =
      Boolean(open) &&
      ((task.taskFilePath && open?.filePath === task.taskFilePath) ||
        open?.document.meta.id === task.taskId);

    if (sameTask) {
      return true;
    }

    if (!task.taskFilePath) {
      setError('Файл задачи не сохранён — откройте задачу вручную.');
      return false;
    }

    return projectActions.openRecent(task.taskFilePath, {
      preserveRecentOrder: true,
    });
  };

  const openTaskCard = async (task: { taskId: string; taskFilePath: string | null }) => {
    setOpeningId(task.taskId);
    try {
      const ok = await ensureTaskOpen(task);
      if (!ok) {
        return;
      }
      void navigate(AppRoutes.taskCurrent);
    } finally {
      setOpeningId(null);
    }
  };

  const openRow = async (row: CatalogTestCaseRow) => {
    setOpeningId(row.id);
    try {
      const ok = await ensureTaskOpen(row);
      if (!ok) {
        return;
      }
      void navigate(testCaseEditorPath(row.id));
    } finally {
      setOpeningId(null);
    }
  };

  const deleteRow = async (row: CatalogTestCaseRow) => {
    setDeletingId(row.id);
    try {
      const ok = await ensureTaskOpen(row);
      if (!ok) {
        return;
      }
      const removed = await testCaseActions.remove([row.id]);
      if (removed && row.taskFilePath) {
        await projectActions.save();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openDuplicate = async (row: CatalogTestCaseRow) => {
    setDuplicatingId(row.id);
    try {
      const ok = await ensureTaskOpen(row);
      if (!ok) {
        return;
      }
      const open = useProjectStore.getState().current;
      setDuplicateSuggestedNumber(nextTestCaseNumber(open?.document.testCases ?? []));
      setDuplicateSource(row);
    } finally {
      setDuplicatingId(null);
    }
  };

  const changeOutcome = async (row: CatalogTestCaseRow, outcome: TestResultOutcome) => {
    const ok = await ensureTaskOpen(row);
    if (!ok) {
      return;
    }

    const updated = testCaseActions.setOutcome(row.id, outcome);
    if (!updated) {
      return;
    }

    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        testCases: group.testCases.map((item) =>
          item.id === row.id
            ? { ...item, testOutcome: outcome, updatedAt: new Date().toISOString() }
            : item,
        ),
      })),
    );
  };

  const query = searchQuery.trim();

  const visibleGroups = useMemo(() => {
    if (!query) {
      return groups;
    }
    return groups
      .map((group) => ({
        ...group,
        testCases: group.testCases.filter((item) => matchesCaseQuery(item, query)),
      }))
      .filter((group) => group.testCases.length > 0);
  }, [groups, query]);

  const totalCount = visibleGroups.reduce((sum, group) => sum + group.testCases.length, 0);

  return (
    <Stack gap="lg">
      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Тест-кейсы</Title>
            <Text c="dimmed" mt="xs">
              Все тест-кейсы из недавних задач. Нажмите на строку, чтобы открыть список кейсов
              {totalCount > 0 ? ` · ${totalCount}` : ''}
            </Text>
          </div>
          <Group gap="xs">
            <ImportWordTestCasesButton
              onImported={() => {
                void reload();
              }}
            />
            <Tooltip label="Обновить список">
              <ActionIcon variant="default" onClick={() => void reload()} loading={loading}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </FadeIn>

      <TextInput
        placeholder="Поиск по номеру, цели или задаче…"
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

      {error ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Ошибка загрузки">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Group justify="center" py="xl">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Загрузка тест-кейсов…
          </Text>
        </Group>
      ) : null}

      {!loading && groups.length === 0 ? (
        <Alert color="gray" title="Нет тест-кейсов">
          Откройте или создайте задачу и добавьте тест-кейсы — они появятся здесь с разбивкой по
          задачам.
        </Alert>
      ) : null}

      {!loading && groups.length > 0 && visibleGroups.length === 0 ? (
        <Alert color="gray" title="Ничего не найдено">
          Нет тест-кейсов по запросу «{query}».
        </Alert>
      ) : null}

      {!loading && visibleGroups.length > 0 ? (
        <FadeIn>
          <Card withBorder padding="lg" radius="lg">
            <Stack gap={4}>
              {visibleGroups.map((group) => {
                const expanded = query.length > 0 || expandedIds.includes(group.taskId);
                return (
                  <div key={group.taskId}>
                    <Group
                      justify="space-between"
                      wrap="nowrap"
                      py="sm"
                      px="xs"
                      className="tcm-task-list-row"
                      style={{
                        cursor: 'pointer',
                        borderRadius: 'var(--mantine-radius-md)',
                      }}
                      onClick={() => toggleGroup(group.taskId)}
                    >
                      <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          aria-label={
                            expanded
                              ? `Свернуть кейсы задачи ${group.taskShortLabel}`
                              : `Показать кейсы задачи ${group.taskShortLabel}`
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleGroup(group.taskId);
                          }}
                        >
                          {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                        </ActionIcon>
                        <Text size="sm" fw={600} truncate title={group.taskName}>
                          {group.taskShortLabel}
                        </Text>
                        <Badge size="xs" variant="light">
                          {group.testCases.length}
                        </Badge>
                      </Group>
                      <Tooltip label="Открыть карточку задачи">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Открыть задачу ${group.taskShortLabel}`}
                          loading={openingId === group.taskId}
                          onClick={(event) => {
                            event.stopPropagation();
                            void openTaskCard(group);
                          }}
                        >
                          <IconClipboardList size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>

                    <Collapse in={expanded}>
                      <Box className="tcm-task-list-subtasks" pt="xs" pb="sm">
                        <TestCasesListTable
                          rows={group.testCases}
                          onOpen={(row) => {
                            const full = findCase(group, row.id);
                            if (full) {
                              void openRow(full);
                            }
                          }}
                          onDuplicate={(row) => {
                            const full = findCase(group, row.id);
                            if (full) {
                              void openDuplicate(full);
                            }
                          }}
                          onDelete={(row) => {
                            const full = findCase(group, row.id);
                            if (full) {
                              void deleteRow(full);
                            }
                          }}
                          onOutcomeChange={(row, outcome) => {
                            const full = findCase(group, row.id);
                            if (full) {
                              void changeOutcome(full, outcome);
                            }
                          }}
                          onReorder={
                            current?.document.meta.id === group.taskId
                              ? (orderedIds) => {
                                  testCaseActions.reorder(orderedIds);
                                }
                              : undefined
                          }
                          openingId={openingId}
                          deletingId={deletingId}
                          duplicatingId={duplicatingId}
                          rowKeyPrefix={`${group.taskId}:`}
                        />
                      </Box>
                    </Collapse>
                  </div>
                );
              })}
            </Stack>
          </Card>
        </FadeIn>
      ) : null}

      <DuplicateTestCaseModal
        opened={Boolean(duplicateSource)}
        sourceNumber={duplicateSource?.number}
        sourceLabel={
          duplicateSource?.goal?.plainText?.trim() || duplicateSource?.title?.trim() || ''
        }
        suggestedNumber={duplicateSuggestedNumber}
        onClose={() => setDuplicateSource(null)}
        onConfirm={(number) => {
          if (!duplicateSource) {
            return;
          }
          const created = testCaseActions.duplicate(duplicateSource.id, number);
          const source = duplicateSource;
          setDuplicateSource(null);
          if (created) {
            if (source.taskFilePath) {
              void projectActions.saveIfDirty({ silent: true });
            }
            void reload();
            void navigate(testCaseEditorPath(created.id));
          }
        }}
      />
    </Stack>
  );
}
