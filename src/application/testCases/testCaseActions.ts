import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { nextTestCaseNumber } from '@/application/testCases/renumberTestCases';
import { confirmAction } from '@/application/ui/confirmAction';
import { createEmptyTestCase } from '@/domain/factories/createEntities';
import type { TestCase, TestResultOutcome } from '@/domain/types';
import { useProjectStore } from '@/stores/useProjectStore';

export type TestCaseFormValues = {
  number: string;
  title: string;
  section: string;
  module: string;
  author: string;
  developer: string;
  businessAnalyst: string;
  priority: TestCase['priority'];
  status: TestCase['status'];
};

function requireOpenProject() {
  const current = useProjectStore.getState().current;
  if (!current) {
    throw new AppError('NOT_FOUND', 'Сначала откройте или создайте задачу');
  }
  return current;
}

export const testCaseActions = {
  create(values: TestCaseFormValues): TestCase | null {
    try {
      const current = requireOpenProject();
      const testCase = createEmptyTestCase({
        number: values.number.trim() || nextTestCaseNumber(current.document.testCases),
        title: values.title.trim(),
        section: values.section.trim(),
        module: values.module.trim(),
        author: values.author.trim(),
        developer: values.developer.trim(),
        businessAnalyst: values.businessAnalyst.trim(),
        priority: values.priority,
        status: values.status,
      });

      useProjectStore.getState().addTestCase(testCase);
      const created = useProjectStore
        .getState()
        .current?.document.testCases.find((item) => item.id === testCase.id);
      void projectActions.saveIfDirty({ silent: true });
      notifySuccess(`Создан тест-кейс ${created?.number ?? testCase.number}`);
      return created ?? testCase;
    } catch (error) {
      notifyError(error, { title: 'Не удалось создать тест-кейс' });
      return null;
    }
  },

  update(id: string, values: TestCaseFormValues): boolean {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }

      useProjectStore.getState().updateTestCase(id, {
        number: values.number.trim(),
        title: values.title.trim(),
        section: values.section.trim(),
        module: values.module.trim(),
        author: values.author.trim(),
        developer: values.developer.trim(),
        businessAnalyst: values.businessAnalyst.trim(),
        priority: values.priority,
        status: values.status,
        updatedAt: new Date().toISOString(),
      });

      notifySuccess('Тест-кейс обновлён');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить тест-кейс' });
      return false;
    }
  },

  duplicate(id: string, number?: string): TestCase | null {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }

      const nextNumber =
        number?.trim() || nextTestCaseNumber(current.document.testCases);
      const title = existing.title.trim()
        ? `${existing.title.trim()} (копия)`
        : '';

      const copy = createEmptyTestCase({
        number: nextNumber,
        title,
        section: existing.section,
        module: existing.module,
        author: existing.author,
        developer: existing.developer,
        businessAnalyst: existing.businessAnalyst,
        priority: existing.priority,
        status: existing.status,
        goal: structuredClone(existing.goal),
        goalImages: structuredClone(existing.goalImages),
        preconditions: existing.preconditions,
        steps: structuredClone(existing.steps),
        verificationResult: structuredClone(existing.verificationResult),
        verificationAttachments: structuredClone(existing.verificationAttachments),
        testOutcome: existing.testOutcome,
        includeInRegression: existing.includeInRegression,
      });

      useProjectStore.getState().addTestCase(copy);
      const created = useProjectStore
        .getState()
        .current?.document.testCases.find((item) => item.id === copy.id);
      void projectActions.saveIfDirty({ silent: true });
      notifySuccess(`Создана копия ${created?.number ?? copy.number}`);
      return created ?? copy;
    } catch (error) {
      notifyError(error, { title: 'Не удалось копировать тест-кейс' });
      return null;
    }
  },

  async remove(ids: string[]): Promise<boolean> {
    try {
      if (ids.length === 0) {
        return false;
      }

      requireOpenProject();

      const confirmed = await confirmAction({
        title: ids.length === 1 ? 'Удалить тест-кейс?' : 'Удалить тест-кейсы?',
        message:
          ids.length === 1
            ? 'Выбранный тест-кейс будет удалён безвозвратно.'
            : `Будет удалено тест-кейсов: ${ids.length}. Действие необратимо.`,
        confirmLabel: 'Удалить',
        cancelLabel: 'Отмена',
        confirmColor: 'red',
      });

      if (!confirmed) {
        return false;
      }

      useProjectStore.getState().deleteTestCases(ids);
      void projectActions.saveIfDirty({ silent: true });
      notifySuccess(ids.length === 1 ? 'Тест-кейс удалён' : `Удалено: ${ids.length}`);
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось удалить' });
      return false;
    }
  },

  setOutcome(id: string, outcome: TestResultOutcome): boolean {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }
      if (existing.testOutcome === outcome) {
        return true;
      }

      useProjectStore.getState().updateTestCase(id, {
        testOutcome: outcome,
      });
      void projectActions.saveIfDirty({ silent: true });
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось изменить результат' });
      return false;
    }
  },

  reorder(orderedIds: string[]): boolean {
    try {
      requireOpenProject();
      useProjectStore.getState().reorderTestCases(orderedIds);
      void projectActions.saveIfDirty({ silent: true });
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось изменить порядок' });
      return false;
    }
  },
};
