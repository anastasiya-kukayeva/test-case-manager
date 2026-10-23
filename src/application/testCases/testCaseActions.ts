import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import type { CopyTargetTask } from '@/application/testCases/listCopyTargetTasks';
import { nextTestCaseNumber } from '@/application/testCases/renumberTestCases';
import { confirmAction } from '@/application/ui/confirmAction';
import { createEmptyTestCase } from '@/domain/factories/createEntities';
import type { TaskDocument, TestCase, TestResultOutcome } from '@/domain/types';
import { projectFileService } from '@/infrastructure/project/projectFileService';
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

export type CopyTestCaseInput = {
  caseId: string;
  sourceTaskId: string;
  sourceFilePath: string | null;
  target: CopyTargetTask;
};

function requireOpenProject() {
  const current = useProjectStore.getState().current;
  if (!current) {
    throw new AppError('NOT_FOUND', 'Сначала откройте или создайте задачу');
  }
  return current;
}

function isOpenTask(taskId: string, filePath: string | null): boolean {
  const current = useProjectStore.getState().current;
  if (!current) {
    return false;
  }
  if (current.document.meta.id === taskId) {
    return true;
  }
  return Boolean(filePath && current.filePath === filePath);
}

function buildTestCaseCopy(
  existing: TestCase,
  targetCases: TestCase[],
  copySuffix: boolean,
): TestCase {
  const title =
    copySuffix && existing.title.trim() ? `${existing.title.trim()} (копия)` : existing.title;

  return createEmptyTestCase({
    number: nextTestCaseNumber(targetCases),
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
    psiSteps: structuredClone(existing.psiSteps ?? []),
    psiResults: structuredClone(existing.psiResults ?? []),
    verificationResult: structuredClone(existing.verificationResult),
    verificationAttachments: structuredClone(existing.verificationAttachments),
    testOutcome: existing.testOutcome,
    includeInReport: existing.includeInReport !== false,
    includeInRollbackReport: existing.includeInRollbackReport !== false,
    includeInRegression: existing.includeInRegression,
    includeInTaskRegression: existing.includeInTaskRegression,
    regressionOnly: existing.regressionOnly === true,
  });
}

function appendToOpenTask(existing: TestCase, copySuffix: boolean): TestCase {
  const current = requireOpenProject();
  const copy = buildTestCaseCopy(existing, current.document.testCases, copySuffix);
  useProjectStore.getState().addTestCase(copy);
  const created = useProjectStore
    .getState()
    .current?.document.testCases.find((item) => item.id === copy.id);
  void projectActions.saveIfDirty({ silent: true });
  return created ?? copy;
}

async function readTaskDocument(taskId: string, filePath: string | null): Promise<TaskDocument> {
  if (isOpenTask(taskId, filePath)) {
    return requireOpenProject().document;
  }
  if (!filePath || filePath.startsWith('__unsaved__')) {
    throw new AppError('NOT_FOUND', 'Сначала сохраните задачу, затем скопируйте тест-кейс');
  }
  if (!projectFileService.isAvailable()) {
    throw new AppError('IPC_UNAVAILABLE', 'Копирование в другую задачу доступно только в Electron');
  }
  const opened = await projectFileService.openFromPath(filePath);
  return opened.document;
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

  duplicate(id: string): TestCase | null {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }

      const created = appendToOpenTask(existing, true);
      notifySuccess(`Создана копия ${created.number}`);
      return created;
    } catch (error) {
      notifyError(error, { title: 'Не удалось копировать тест-кейс' });
      return null;
    }
  },

  async copyToTask(input: CopyTestCaseInput): Promise<TestCase | null> {
    try {
      const sourceDocument = await readTaskDocument(input.sourceTaskId, input.sourceFilePath);
      const existing = sourceDocument.testCases.find((item) => item.id === input.caseId);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }
      const sourceCase = structuredClone(existing);
      const targetIsOpen = isOpenTask(input.target.taskId, input.target.filePath);

      if (targetIsOpen) {
        const created = appendToOpenTask(sourceCase, true);
        notifySuccess(`Создана копия ${created.number}`);
        return created;
      }

      const saved = await projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
      if (!saved) {
        return null;
      }

      const targetPath = input.target.filePath;
      if (!targetPath || targetPath.startsWith('__unsaved__')) {
        throw new AppError(
          'NOT_FOUND',
          'Сначала сохраните задачу, затем скопируйте в неё тест-кейс',
        );
      }
      if (!projectFileService.isAvailable()) {
        throw new AppError(
          'IPC_UNAVAILABLE',
          'Копирование в другую задачу доступно только в Electron',
        );
      }

      const opened = await projectFileService.openFromPath(targetPath);
      const copy = buildTestCaseCopy(sourceCase, opened.document.testCases, false);
      const document: TaskDocument = {
        ...opened.document,
        meta: {
          ...opened.document.meta,
          updatedAt: new Date().toISOString(),
        },
        testCases: [...opened.document.testCases, copy],
      };
      const savedPath = await projectFileService.saveToPath(opened.filePath, document);
      const openedNow = await projectActions.openRecent(savedPath);
      if (!openedNow) {
        throw new AppError('STORAGE_READ', 'Копия записана, но не удалось открыть задачу');
      }

      const created =
        useProjectStore
          .getState()
          .current?.document.testCases.find((item) => item.id === copy.id) ?? copy;
      notifySuccess(`Тест-кейс скопирован в «${input.target.shortLabel}»`);
      return created;
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

  setRegressionFlags(
    id: string,
    patch: { includeInRegression?: boolean; includeInTaskRegression?: boolean },
  ): boolean {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }
      const nextRegression = patch.includeInRegression ?? existing.includeInRegression;
      const nextTaskRegression = patch.includeInTaskRegression ?? existing.includeInTaskRegression;
      if (
        existing.includeInRegression === nextRegression &&
        existing.includeInTaskRegression === nextTaskRegression
      ) {
        return true;
      }

      useProjectStore.getState().updateTestCase(id, {
        includeInRegression: nextRegression,
        includeInTaskRegression: nextTaskRegression,
      });
      void projectActions.saveIfDirty({ silent: true });
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось изменить отметку регресса' });
      return false;
    }
  },

  setIncludeInReport(id: string, includeInReport: boolean): boolean {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }
      if ((existing.includeInReport !== false) === includeInReport) {
        return true;
      }

      useProjectStore.getState().updateTestCase(id, { includeInReport });
      void projectActions.saveIfDirty({ silent: true });
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось изменить отметку отчёта' });
      return false;
    }
  },

  setIncludeInRollbackReport(id: string, includeInRollbackReport: boolean): boolean {
    try {
      const current = requireOpenProject();
      const existing = current.document.testCases.find((item) => item.id === id);
      if (!existing) {
        throw new AppError('NOT_FOUND', 'Тест-кейс не найден');
      }
      if ((existing.includeInRollbackReport !== false) === includeInRollbackReport) {
        return true;
      }

      useProjectStore.getState().updateTestCase(id, { includeInRollbackReport });
      void projectActions.saveIfDirty({ silent: true });
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось изменить отметку отчёта отката' });
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
