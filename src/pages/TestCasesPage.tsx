import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  filterTestCases,
  toTestCaseRows,
  type TestCaseTableRow,
} from '@/application/testCases/filterTestCases';
import { nextTestCaseNumber } from '@/application/testCases/renumberTestCases';
import { testCaseActions } from '@/application/testCases/testCaseActions';
import { DuplicateTestCaseModal } from '@/components/testCases/DuplicateTestCaseModal';
import { ImportWordTestCasesButton } from '@/components/testCases/ImportWordTestCasesButton';
import { TestCaseDateFilter } from '@/components/testCases/TestCaseDateFilter';
import { TestCaseFormModal } from '@/components/testCases/TestCaseFormModal';
import {
  TestCasesListTable,
  type TestCasesListRow,
} from '@/components/testCases/TestCasesListTable';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { AppRoutes, testCaseEditorPath } from '@/routes/paths';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';
import { useUiStore } from '@/stores/useUiStore';

export function TestCasesPage() {
  const navigate = useNavigate();
  const current = useProjectStore((state) => state.current);
  const filters = useTestCaseTableStore((state) => state.filters);
  const createTestCaseRequestId = useUiStore((state) => state.createTestCaseRequestId);

  const [formOpened, setFormOpened] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<TestCaseTableRow | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<TestCasesListRow | null>(null);

  useEffect(() => {
    if (createTestCaseRequestId > 0 && current) {
      setFormMode('create');
      setEditing(null);
      setFormOpened(true);
    }
  }, [createTestCaseRequestId, current]);

  const allRows = useMemo(() => {
    if (!current) {
      return [];
    }
    return toTestCaseRows(current.document.testCases, current.document.meta.name);
  }, [current]);

  const filteredRows = useMemo(
    () => filterTestCases(allRows, filters),
    [allRows, filters],
  );

  if (!current) {
    return (
      <Stack gap="lg">
        <div>
          <Title order={2}>Задача не выбрана</Title>
          <Text c="dimmed" mt="xs">
            Для работы со списком нужна открытая задача.
          </Text>
        </div>
        <Alert icon={<IconInfoCircle size={16} />} title="Задача не открыта" color="yellow">
          Создайте или откройте задачу на странице «Задачи».
        </Alert>
        <Button w="fit-content" onClick={() => void navigate(AppRoutes.tasks)}>
          Перейти к задачам
        </Button>
      </Stack>
    );
  }

  const openCreate = () => {
    setFormMode('create');
    setEditing(null);
    setFormOpened(true);
  };

  const openEdit = (row: { id: string }) => {
    void navigate(testCaseEditorPath(row.id));
  };

  const suggestedNumber =
    formMode === 'create' ? nextTestCaseNumber(current.document.testCases) : undefined;

  const duplicateSuggestedNumber = nextTestCaseNumber(current.document.testCases);
  const duplicateLabel =
    duplicateSource?.goal?.plainText?.trim() || duplicateSource?.title?.trim() || '';

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Title order={2}>{getTaskShortLabel(current.document.meta)}</Title>
        <Group gap="sm">
          <ImportWordTestCasesButton />
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Создать тест-кейс
          </Button>
        </Group>
      </Group>

      <Card withBorder padding="md" radius="lg">
        <TestCaseDateFilter />
      </Card>

      <Card withBorder padding="md" radius="lg">
        <TestCasesListTable
          rows={filteredRows}
          onOpen={openEdit}
          onDuplicate={(row) => {
            setDuplicateSource(row);
          }}
          onDelete={(row) => {
            void testCaseActions.remove([row.id]);
          }}
          onOutcomeChange={(row, outcome) => {
            testCaseActions.setOutcome(row.id, outcome);
          }}
          onReorder={(orderedIds) => {
            testCaseActions.reorder(orderedIds);
          }}
          emptyText="Нет тест-кейсов по текущим фильтрам"
        />
      </Card>

      <TestCaseFormModal
        opened={formOpened}
        mode={formMode}
        initial={editing}
        suggestedNumber={suggestedNumber}
        onClose={() => setFormOpened(false)}
        onSubmit={(values) => {
          if (formMode === 'create') {
            const created = testCaseActions.create(values);
            if (created) {
              setFormOpened(false);
              void navigate(testCaseEditorPath(created.id));
            }
            return;
          }

          if (editing) {
            const ok = testCaseActions.update(editing.id, values);
            if (ok) {
              setFormOpened(false);
              void navigate(testCaseEditorPath(editing.id));
            }
          }
        }}
      />

      <DuplicateTestCaseModal
        opened={Boolean(duplicateSource)}
        sourceNumber={duplicateSource?.number}
        sourceLabel={duplicateLabel}
        suggestedNumber={duplicateSuggestedNumber}
        onClose={() => setDuplicateSource(null)}
        onConfirm={(number) => {
          if (!duplicateSource) {
            return;
          }
          const created = testCaseActions.duplicate(duplicateSource.id, number);
          setDuplicateSource(null);
          if (created) {
            void navigate(testCaseEditorPath(created.id));
          }
        }}
      />
    </Stack>
  );
}
