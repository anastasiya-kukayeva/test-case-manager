import { AppError } from '@/application/errors/AppError';
import { notifyError } from '@/application/errors/errorHandler';
import { notifyExportSaved } from '@/application/export/notifyExportSaved';
import { DEFAULT_APP_SETTINGS, type TaskDocument, type TestCase } from '@/domain/types';
import { buildPmiDocx, buildTestCaseDocx } from '@/infrastructure/export/docxExportService';
import { uint8ArrayToBase64 } from '@/infrastructure/export/exportUtils';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

function sanitizeFileName(name: string): string {
  const withoutControls = Array.from(name)
    .filter((char) => char.charCodeAt(0) >= 32)
    .join('');
  return withoutControls.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Без названия';
}

function exportDocumentFileName(document: TaskDocument): string {
  return `${sanitizeFileName(document.meta.name?.trim() || 'Без названия')}.docx`;
}

function requireExportApi() {
  const api = window.electronAPI;
  if (!api?.dialog || !api.file?.writeBinary) {
    throw new AppError(
      'IPC_UNAVAILABLE',
      'Экспорт доступен только в Electron. Запустите приложение через npm run dev.',
    );
  }
  return api;
}

function requireOpenTask(): TaskDocument {
  const current = useProjectStore.getState().current;
  if (!current) {
    throw new AppError('NOT_FOUND', 'Откройте задачу перед экспортом');
  }
  return current.document;
}

function withMergedTestCase(document: TaskDocument, testCase: TestCase): TaskDocument {
  const hasCase = document.testCases.some((item) => item.id === testCase.id);
  return {
    ...document,
    testCases: hasCase
      ? document.testCases.map((item) => (item.id === testCase.id ? testCase : item))
      : [...document.testCases, testCase],
  };
}

function fileBaseName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function mapFileWriteError(error: unknown, filePath: string): AppError {
  const raw = error instanceof Error ? error.message : String(error);
  if (/EBUSY|EPERM|EACCES|resource busy|locked/i.test(raw)) {
    return new AppError(
      'STORAGE_WRITE',
      `Файл занят другим приложением (часто открыт в Word). Закройте «${fileBaseName(filePath)}» и повторите экспорт либо сохраните под другим именем.`,
      { cause: error, details: { filePath } },
    );
  }
  return AppError.fromUnknown(error, `Не удалось сохранить файл «${fileBaseName(filePath)}»`);
}

async function saveDocxFile(args: {
  bytes: Uint8Array;
  suggestedName: string;
  title: string;
}): Promise<string | null> {
  const api = requireExportApi();
  const filePath = await api.dialog.saveFile({
    title: args.title,
    defaultPath: args.suggestedName,
    filters: [
      { name: 'Word Document', extensions: ['docx'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
  });

  if (!filePath) {
    return null;
  }

  const targetPath = filePath.toLowerCase().endsWith('.docx') ? filePath : `${filePath}.docx`;
  try {
    await api.file.writeBinary(targetPath, uint8ArrayToBase64(args.bytes));
  } catch (error) {
    throw mapFileWriteError(error, targetPath);
  }
  return targetPath;
}

export const exportActions = {
  /** Full PMI (methodology) Word export for the open task. */
  async exportTaskToDocx(): Promise<boolean> {
    try {
      const document = requireOpenTask();
      const settings = useAppStore.getState().settings.export ?? DEFAULT_APP_SETTINGS.export;
      const bytes = await buildPmiDocx({ document, settings });
      const savedPath = await saveDocxFile({
        bytes,
        suggestedName: exportDocumentFileName(document),
        title: 'Экспорт ПМИ в Word',
      });

      if (!savedPath) {
        return false;
      }

      notifyExportSaved(savedPath, 'DOCX');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось экспортировать ПМИ в Word' });
      return false;
    }
  },

  async exportTestCaseToDocx(_testCaseId: string): Promise<boolean> {
    return this.exportTaskToDocx();
  },

  async exportTestCaseObjectToDocx(testCase: TestCase, _taskName: string): Promise<boolean> {
    try {
      const document = withMergedTestCase(requireOpenTask(), testCase);
      const settings = useAppStore.getState().settings.export ?? DEFAULT_APP_SETTINGS.export;
      const bytes = await buildTestCaseDocx({
        testCase,
        taskName: document.meta.name,
        settings,
        document,
      });
      const savedPath = await saveDocxFile({
        bytes,
        suggestedName: exportDocumentFileName(document),
        title: 'Экспорт ПМИ в Word',
      });

      if (!savedPath) {
        return false;
      }

      notifyExportSaved(savedPath, 'DOCX');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось экспортировать ПМИ в Word' });
      return false;
    }
  },
};
