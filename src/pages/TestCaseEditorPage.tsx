import { Alert, Button, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { formValuesToTestCasePatch } from '@/application/testCases/testCaseFormMapper';
import { TestCaseEditorForm } from '@/components/editor/TestCaseEditorForm';
import type { TestCaseEditorFormValues } from '@/domain/schemas/testCaseSchema';
import { AppRoutes } from '@/routes/paths';
import { useProjectStore } from '@/stores/useProjectStore';

export function TestCaseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const current = useProjectStore((state) => state.current);
  const updateTestCase = useProjectStore((state) => state.updateTestCase);
  const flushRef = useRef<(() => void) | null>(null);
  const leavingRef = useRef(false);

  const testCase = useMemo(
    () => current?.document.testCases.find((item) => item.id === id) ?? null,
    [current, id],
  );

  const persist = useCallback(
    (values: TestCaseEditorFormValues, notify: boolean) => {
      if (!id) {
        return;
      }
      updateTestCase(id, formValuesToTestCasePatch(values));
      if (notify) {
        notifySuccess('Тест-кейс сохранён');
      }
    },
    [id, updateTestCase],
  );

  const leaveToList = useCallback(async () => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    try {
      flushRef.current?.();
      await projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
      void navigate(AppRoutes.testCases);
    } finally {
      leavingRef.current = false;
    }
  }, [navigate]);

  // Flush + save when leaving via sidebar / route change (not only the Back button).
  useEffect(() => {
    return () => {
      flushRef.current?.();
      void projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
    };
  }, []);

  if (!current) {
    return (
      <Stack gap="md">
        <Alert icon={<IconInfoCircle size={16} />} color="yellow" title="Задача не открыта">
          Откройте задачу, чтобы редактировать тест-кейсы.
        </Alert>
        <Button w="fit-content" onClick={() => void navigate(AppRoutes.tasks)}>
          К задачам
        </Button>
      </Stack>
    );
  }

  if (!testCase) {
    return (
      <Stack gap="md">
        <Title order={3}>Тест-кейс не найден</Title>
        <Text c="dimmed">Возможно, он был удалён.</Text>
        <Button
          w="fit-content"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => void navigate(AppRoutes.testCases)}
        >
          К списку тест-кейсов
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Button
        variant="subtle"
        w="fit-content"
        leftSection={<IconArrowLeft size={16} />}
        onClick={() => void leaveToList()}
      >
        Назад к списку
      </Button>

      <TestCaseEditorForm
        key={testCase.id}
        testCase={testCase}
        taskName={current.document.meta.name}
        onSave={(values) => {
          void (async () => {
            if (leavingRef.current) {
              return;
            }
            leavingRef.current = true;
            try {
              persist(values, true);
              await projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
              void navigate(AppRoutes.testCases);
            } finally {
              leavingRef.current = false;
            }
          })();
        }}
        onAutoSave={(values) => persist(values, false)}
        onRegisterFlush={(flush) => {
          flushRef.current = flush;
        }}
      />
    </Stack>
  );
}
