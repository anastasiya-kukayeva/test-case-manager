import { AppError } from '@/application/errors/AppError';
import {
  TC_TASK_FILE_EXTENSION,
  TC_TASK_FILE_EXTENSION_LEGACY,
  type TaskDocument,
} from '@/domain/types';
import {
  ensureTaskExtension,
  parseTaskFileContent,
  serializeTaskDocument,
} from '@/infrastructure/project/tcprojFormat';

function requireFileApi() {
  const api = window.electronAPI;
  if (!api?.file || !api.dialog || !api.app) {
    throw new AppError(
      'IPC_UNAVAILABLE',
      'Файловые операции доступны только в Electron. Запустите приложение через npm run dev.',
    );
  }
  return api;
}

const TASK_FILTERS = [
  {
    name: 'Test Case Manager Task',
    extensions: [TC_TASK_FILE_EXTENSION, TC_TASK_FILE_EXTENSION_LEGACY],
  },
  { name: 'Все файлы', extensions: ['*'] },
];

export const projectFileService = {
  isAvailable(): boolean {
    return Boolean(window.electronAPI?.file && window.electronAPI?.dialog);
  },

  async openWithDialog(defaultPath?: string): Promise<{ filePath: string; document: TaskDocument } | null> {
    const api = requireFileApi();
    const filePath = await api.dialog.openFile({
      title: 'Открыть задачу',
      defaultPath,
      filters: TASK_FILTERS,
      properties: ['openFile'],
    });

    if (!filePath) {
      return null;
    }

    return this.openFromPath(filePath);
  },

  async openFromPath(filePath: string): Promise<{ filePath: string; document: TaskDocument }> {
    const api = requireFileApi();

    try {
      const exists = await api.file.exists(filePath);
      if (!exists) {
        throw new AppError('NOT_FOUND', `Файл задачи не найден:\n${filePath}`);
      }

      const { content } = await api.file.read(filePath);
      const document = parseTaskFileContent(content);
      return { filePath, document };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('STORAGE_READ', 'Не удалось открыть файл задачи', { cause: error });
    }
  },

  async saveToPath(filePath: string, document: TaskDocument): Promise<string> {
    const api = requireFileApi();
    const targetPath = ensureTaskExtension(filePath);

    try {
      const content = serializeTaskDocument(document);
      await api.file.write(targetPath, content);
      return targetPath;
    } catch (error) {
      throw new AppError('STORAGE_WRITE', 'Не удалось сохранить файл задачи', { cause: error });
    }
  },

  async saveWithDialog(
    document: TaskDocument,
    defaultPath?: string,
  ): Promise<{ filePath: string; document: TaskDocument } | null> {
    const api = requireFileApi();
    const label =
      document.meta.shortName?.trim() || document.meta.name.trim() || 'task';
    const safeLabel = label
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    const suggestedName = `${safeLabel || 'task'}.${TC_TASK_FILE_EXTENSION}`;
    const filePath = await api.dialog.saveFile({
      title: 'Сохранить задачу как',
      defaultPath: defaultPath ?? suggestedName,
      filters: TASK_FILTERS,
    });

    if (!filePath) {
      return null;
    }

    const savedPath = await this.saveToPath(filePath, document);
    return { filePath: savedPath, document };
  },
};

export const taskFileService = projectFileService;
