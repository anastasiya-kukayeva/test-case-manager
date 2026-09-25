import { Alert, Button, Card, Group, Stack, Text, Title, Tooltip, UnstyledButton } from '@mantine/core';
import { IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { filterTestCases, toTestCaseRows } from '@/application/testCases/filterTestCases';
import {
  isRegressionMode,
  matchesRegressionMode,
  REGRESSION_MODE_LABELS,
  type RegressionMode,
} from '@/application/regression/loadRegressionGroups';
import { nextTestCaseNumber } from '@/application/testCases/renumberTestCases';
import { testCaseActions } from '@/application/testCases/testCaseActions';
import { DuplicateTestCaseModal } from '@/components/testCases/DuplicateTestCaseModal';
import { TestCaseDateFilter } from '@/components/testCases/TestCaseDateFilter';
import {
  TestCasesListTable,
  type TestCasesListRow,
} from '@/components/testCases/TestCasesListTable';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { AppRoutes, regressionBrowsePath, testCaseEditorPath } from '@/routes/paths';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTestCaseTableStore } from '@/stores/useTestCaseTableStore';

function modeFromState(state: unknown): RegressionMode {
  const mode = (state as { mode?: string } | null)?.mode;
  return isRegressionMode(mode) ? mode : 'suite';
}

export function RegressionCasesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = modeFromState(location.state);
  const current = useProjectStore((state) => state.current);
  const filters = useTestCaseTableStore((state) => state.filters);
  const [duplicateSource, setDuplicateSource] = useState<TestCasesListRow | null>(null);

  const allRows = useMemo(() => {
    if (!current) {
      return [];
    }
    const cases = current.document.testCases.filter((item) => matchesRegressionMode(item, mode));
    return toTestCaseRows(cases, current.document.meta.name);
  }, [current, mode]);

  const filteredRows = useMemo(() => {
    return filterTestCases(allRows, filters).map((row, index) => ({
      ...row,
      number: String(index + 1),
    }));
  }, [allRows, filters]);

  const openEditor = (id: string) => {
    void navigate(testCaseEditorPath(id), { state: { from: 'regression', mode } });
  };

  if (!current) {
    return (
      <Stack gap="lg">
        <Title order={2}>{REGRESSION_MODE_LABELS[mode]}</Title>
        <Alert icon={<IconInfoCircle size={16} />} title="Задача не открыта" color="yellow">
          Выберите задачу в списке регресса.
        </Alert>
        <Button w="fit-content" onClick={() => void navigate(regressionBrowsePath(mode))}>
          К списку
        </Button>
      </Stack>
    );
  }

  const duplicateSuggestedNumber = nextTestCaseNumber(current.document.testCases);
  const duplicateSourceNumber = current.document.testCases.find(
    (item) => item.id === duplicateSource?.id,
  )?.number;
  const duplicateLabel =
    duplicateSource?.goal?.plainText?.trim() || duplicateSource?.title?.trim() || '';
  const checkboxLabel =
    mode === 'task' ? 'Добавить в регресс задачи?' : 'Добавить в регресс?';

  return (
    <Stack gap="lg">
      <Button
        variant="subtle"
        w="fit-content"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => void navigate(regressionBrowsePath(mode))}
      >
        К списку
      </Button>

      <Group justify="space-between" align="flex-start">
        <Tooltip label="Открыть карточку задачи" position="top-start">
          <UnstyledButton
            className="tcm-task-name-link"
            aria-label="Открыть карточку задачи"
            onClick={() => void navigate(AppRoutes.taskCurrent)}
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Title order={2}>{getTaskShortLabel(current.document.meta)}</Title>
          </UnstyledButton>
        </Tooltip>
      </Group>

      <Text c="dimmed" size="sm">
        {REGRESSION_MODE_LABELS[mode]} · кейсы с отметкой «{checkboxLabel}»
        {filteredRows.length > 0 ? ` · ${filteredRows.length}` : ''}
      </Text>

      <Card withBorder padding="md" radius="lg">
        <TestCaseDateFilter />
      </Card>

      <Card withBorder padding="md" radius="lg">
        <TestCasesListTable
          rows={filteredRows}
          onOpen={(row) => openEditor(row.id)}
          onDuplicate={(row) => setDuplicateSource(row)}
          onDelete={(row) => {
            void testCaseActions.remove([row.id]);
          }}
          onOutcomeChange={(row, outcome) => {
            testCaseActions.setOutcome(row.id, outcome);
          }}
          emptyText="Нет кейсов для этого списка по текущим фильтрам"
        />
      </Card>

      <DuplicateTestCaseModal
        opened={Boolean(duplicateSource)}
        sourceNumber={duplicateSourceNumber}
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
            openEditor(created.id);
          }
        }}
      />
    </Stack>
  );
}
