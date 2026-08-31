import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
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
import { testCaseEditorPath } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

export function AllTestCasesPage() {
  const navigate = useNavigate();
  const recentProjects = useAppStore((state) => state.recentProjects);
  const current = useProjectStore((state) => state.current);
  const [groups, setGroups] = useState<CatalogTaskGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<CatalogTestCaseRow | null>(null);
  const [duplicateSuggestedNumber, setDuplicateSuggestedNumber] = useState('1');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await loadCatalogTestCaseGroups();
      setGroups(next);
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

  const ensureTaskOpen = async (row: CatalogTestCaseRow): Promise<boolean> => {
    const open = useProjectStore.getState().current;
    const sameTask =
      Boolean(open) &&
      ((row.taskFilePath && open?.filePath === row.taskFilePath) ||
        open?.document.meta.id === row.taskId);

    if (sameTask) {
      return true;
    }

    if (!row.taskFilePath) {
      setError('Файл задачи не сохранён — откройте задачу вручную.');
      return false;
    }

    return projectActions.openRecent(row.taskFilePath, {
      preserveRecentOrder: true,
    });
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

  const totalCount = groups.reduce((sum, group) => sum + group.testCases.length, 0);

  return (
    <Stack gap="lg">
      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2}>Тест-кейсы</Title>
            <Text c="dimmed" mt="xs">
              Все тест-кейсы из недавних задач, сгруппированные по задаче
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

      {!loading && groups.length > 0 ? (
        <FadeIn>
          <Accordion multiple variant="separated" radius="lg" defaultValue={[]}>
            {groups.map((group) => (
              <Accordion.Item key={group.taskId} value={group.taskId}>
                <Accordion.Control>
                  <Group justify="space-between" pr="md" wrap="nowrap">
                    <div style={{ minWidth: 0 }}>
                      <Text fw={700} lineClamp={1}>
                        {group.taskShortLabel}
                      </Text>
                      {group.taskShortLabel !== group.taskName ? (
                        <Text size="sm" c="dimmed" lineClamp={1} title={group.taskName}>
                          {group.taskName}
                        </Text>
                      ) : null}
                    </div>
                    <Badge variant="light">{group.testCases.length}</Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <TestCasesListTable
                    rows={group.testCases}
                    onOpen={(row) => {
                      const full = group.testCases.find((item) => item.id === row.id);
                      if (full) {
                        void openRow(full);
                      }
                    }}
                    onDuplicate={(row) => {
                      const full = group.testCases.find((item) => item.id === row.id);
                      if (full) {
                        void openDuplicate(full);
                      }
                    }}
                    onDelete={(row) => {
                      const full = group.testCases.find((item) => item.id === row.id);
                      if (full) {
                        void deleteRow(full);
                      }
                    }}
                    onOutcomeChange={(row, outcome) => {
                      const full = group.testCases.find((item) => item.id === row.id);
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
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
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
