import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { renumberTestCases } from '@/application/testCases/renumberTestCases';
import type { TaskMeta } from '@/domain/types';
import { importTestCasesFromDocxBase64 } from '@/infrastructure/import/docxImportService';
import type { ParsedPmiTaskFields } from '@/infrastructure/import/parsePmiWordHtml';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

function requireImportApi() {
  const api = window.electronAPI;
  if (!api?.dialog?.openFile || !api.file?.readBinary) {
    throw new AppError(
      'IPC_UNAVAILABLE',
      'Импорт Word доступен только в Electron. Запустите приложение через npm run dev.',
    );
  }
  return api;
}

function metaPatch(task: ParsedPmiTaskFields): Partial<TaskMeta> {
  const patch: Partial<TaskMeta> = {};
  if (task.name) {
    patch.name = task.name;
  }
  if (task.releaseNumber) {
    patch.releaseNumber = task.releaseNumber;
  }
  if (task.testObject) {
    patch.testObject = task.testObject;
  }
  if (task.testObjectLinks && task.testObjectLinks.length > 0) {
    patch.testObjectLinks = task.testObjectLinks;
  }
  if (task.testGoal) {
    patch.testGoal = task.testGoal;
  }
  if (task.generalProvisions) {
    patch.generalProvisions = task.generalProvisions;
  }
  if (task.functionalRequirements) {
    patch.functionalRequirements = task.functionalRequirements;
  }
  if (task.risksAndLimitations) {
    patch.risksAndLimitations = task.risksAndLimitations;
  }
  return patch;
}

function describeImport(fieldCount: number, caseCount: number): string {
  const parts: string[] = [];
  if (fieldCount > 0) {
    parts.push('Поля задачи заполнены из файла');
  }
  if (caseCount > 0) {
    parts.push(`Импортировано тест-кейсов: ${caseCount}`);
  }
  return parts.join('. ');
}

export const wordImportActions = {
  /**
   * Import a PMI Word file into the open task: fill card fields that the
   * document contains, and append test cases to the task list.
   */
  async importIntoCurrentTask(): Promise<boolean> {
    try {
      const api = requireImportApi();
      const current = useProjectStore.getState().current;
      if (!current) {
        throw new AppError('NOT_FOUND', 'Сначала откройте задачу');
      }

      const defaultDir =
        useAppStore.getState().settings.storage.defaultProjectsDirectory ?? undefined;

      const filePath = await api.dialog.openFile({
        title: 'Импорт задачи из Word',
        defaultPath: defaultDir,
        filters: [
          { name: 'Документ Word', extensions: ['docx'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (!filePath) {
        return false;
      }

      const { base64 } = await api.file.readBinary(filePath);
      const startNumber = useProjectStore.getState().current?.document.testCases.length ?? 0;
      const imported = await importTestCasesFromDocxBase64(base64, startNumber + 1);
      const patch = metaPatch(imported.task);

      if (Object.keys(patch).length === 0 && imported.testCases.length === 0) {
        throw new AppError(
          'VALIDATION',
          'В файле не найдены поля задачи и тест-кейсы. Нужен документ ПМИ, выгруженный из этой программы.',
        );
      }

      const latest = useProjectStore.getState().current;
      if (!latest) {
        throw new AppError('NOT_FOUND', 'Задача больше не открыта');
      }

      useProjectStore.getState().updateDocument({
        ...latest.document,
        meta: {
          ...latest.document.meta,
          ...patch,
        },
        testCases:
          imported.testCases.length > 0
            ? renumberTestCases([...latest.document.testCases, ...imported.testCases])
            : latest.document.testCases,
      });

      void projectActions.saveIfDirty({ silent: true });
      notifySuccess(describeImport(Object.keys(patch).length, imported.testCases.length));
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось импортировать Word' });
      return false;
    }
  },
};
