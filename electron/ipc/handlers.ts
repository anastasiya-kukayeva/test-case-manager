import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  IpcChannels,
  type AppPathName,
  type FileWriteBinaryRequest,
  type FileWriteRequest,
  type OpenFileDialogOptions,
  type SaveFileDialogOptions,
} from './channels';
import { electronStore, type ElectronStoreSchema } from '../store';

function getBrowserWindowFromEvent(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannels.STORE_GET, (_event, key: string) => {
    return electronStore.get(key as keyof ElectronStoreSchema);
  });

  ipcMain.handle(IpcChannels.STORE_SET, (_event, key: string, value: unknown) => {
    electronStore.set(key as keyof ElectronStoreSchema, value as never);
    return true;
  });

  ipcMain.handle(IpcChannels.STORE_DELETE, (_event, key: string) => {
    electronStore.delete(key as keyof ElectronStoreSchema);
    return true;
  });

  ipcMain.handle(IpcChannels.STORE_CLEAR, () => {
    electronStore.clear();
    return true;
  });

  ipcMain.handle(IpcChannels.APP_GET_PATH, (_event, name: AppPathName) => {
    return app.getPath(name);
  });

  ipcMain.handle(IpcChannels.DIALOG_OPEN_FILE, async (event, options: OpenFileDialogOptions = {}) => {
    const browserWindow = getBrowserWindowFromEvent(event);
    const dialogOptions = {
      title: options.title ?? 'Открыть файл',
      defaultPath: options.defaultPath,
      filters: options.filters,
      properties: options.properties ?? (['openFile'] as Array<'openFile' | 'openDirectory' | 'multiSelections'>),
    };

    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IpcChannels.DIALOG_SAVE_FILE, async (event, options: SaveFileDialogOptions = {}) => {
    const browserWindow = getBrowserWindowFromEvent(event);
    const dialogOptions = {
      title: options.title ?? 'Сохранить файл',
      defaultPath: options.defaultPath,
      filters: options.filters,
    };

    const result = browserWindow
      ? await dialog.showSaveDialog(browserWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  ipcMain.handle(IpcChannels.FILE_READ, async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return { path: filePath, content };
  });

  ipcMain.handle(IpcChannels.FILE_READ_BINARY, async (_event, filePath: string) => {
    const buffer = await fs.readFile(filePath);
    return { path: filePath, base64: buffer.toString('base64') };
  });

  ipcMain.handle(IpcChannels.FILE_WRITE, async (_event, request: FileWriteRequest) => {
    await fs.mkdir(path.dirname(request.path), { recursive: true });
    await fs.writeFile(request.path, request.content, 'utf-8');
    return true;
  });

  ipcMain.handle(IpcChannels.FILE_WRITE_BINARY, async (_event, request: FileWriteBinaryRequest) => {
    try {
      await fs.mkdir(path.dirname(request.path), { recursive: true });
      await fs.writeFile(request.path, Buffer.from(request.base64, 'base64'));
      return true;
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
        throw new Error(
          `${code}: resource busy or locked, open '${request.path}'`,
        );
      }
      throw error;
    }
  });

  ipcMain.handle(IpcChannels.FILE_EXISTS, async (_event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IpcChannels.FILE_DELETE, async (_event, filePath: string) => {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IpcChannels.FILE_ENSURE_DIR, async (_event, dirPath: string) => {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  });

  ipcMain.handle(IpcChannels.SHELL_OPEN_PATH, async (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return 'Путь к файлу не указан';
    }
    // Returns empty string on success, or an error message.
    return shell.openPath(filePath);
  });
}
