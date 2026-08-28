import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import { renumberTestCases } from '@/application/testCases/renumberTestCases';
import { importTestCasesFromDocxBase64 } from '@/infrastructure/import/docxImportService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

export type WordImportTaskTarget =
  | { type: 'current' }
  | { type: 'file'; filePath: string; label: string };

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

async function ensureTargetTaskOpen(target: WordImportTaskTarget): Promise<boolean> {
  if (target.type === 'current') {
    if (!useProjectStore.getState().current) {
      throw new AppError('NOT_FOUND', 'Открытая задача больше недоступна');
    }
    return true;
  }

  return projectActions.openRecent(target.filePath, { preserveRecentOrder: true });
}

export const wordImportActions = {
  /**
   * Import PMI test cases from a Word file into the chosen task
   * (opens that task first when needed, then appends cases).
   */
  async importIntoTask(target: WordImportTaskTarget): Promise<number> {
    try {
      const api = requireImportApi();

      const opened = await ensureTargetTaskOpen(target);
      if (!opened) {
        return 0;
      }

      const defaultDir =
        useAppStore.getState().settings.storage.defaultProjectsDirectory ?? undefined;

      const filePath = await api.dialog.openFile({
        title: 'Импорт тест-кейсов из Word',
        defaultPath: defaultDir,
        filters: [
          { name: 'Документ Word', extensions: ['docx'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });

      if (!filePath) {
        return 0;
      }

      const current = useProjectStore.getState().current;
      if (!current) {
        throw new AppError('NOT_FOUND', 'Задача не открыта');
      }

      const { base64 } = await api.file.readBinary(filePath);
      const startNumber = current.document.testCases.length + 1;
      const { testCases } = await importTestCasesFromDocxBase64(base64, startNumber);

      if (testCases.length === 0) {
        throw new AppError('VALIDATION', 'В файле не найдено ни одного тест-кейса');
      }

      const latest = useProjectStore.getState().current;
      if (!latest) {
        throw new AppError('NOT_FOUND', 'Задача больше не открыта');
      }

      useProjectStore.getState().updateDocument({
        ...latest.document,
        testCases: renumberTestCases([...latest.document.testCases, ...testCases]),
      });

      void projectActions.saveIfDirty({ silent: true });
      notifySuccess(`Импортировано тест-кейсов: ${testCases.length}`);
      return testCases.length;
    } catch (error) {
      notifyError(error, { title: 'Не удалось импортировать Word' });
      return 0;
    }
  },
};
