import { contextBridge, ipcRenderer } from 'electron';
import {
  IpcChannels,
  type AppPathName,
  type FileReadBinaryResult,
  type FileReadResult,
  type OpenFileDialogOptions,
  type SaveFileDialogOptions,
} from './ipc/channels';

export type ElectronApi = {
  platform: NodeJS.Platform;
  versions: {
    node: string;
    chrome: string;
    electron: string;
  };
  store: {
    get: <T = unknown>(key: string) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<boolean>;
  };
  app: {
    getPath: (name: AppPathName) => Promise<string>;
  };
  dialog: {
    openFile: (options?: OpenFileDialogOptions) => Promise<string | null>;
    saveFile: (options?: SaveFileDialogOptions) => Promise<string | null>;
  };
  file: {
    read: (filePath: string) => Promise<FileReadResult>;
    readBinary: (filePath: string) => Promise<FileReadBinaryResult>;
    write: (filePath: string, content: string) => Promise<boolean>;
    writeBinary: (filePath: string, base64: string) => Promise<boolean>;
    exists: (filePath: string) => Promise<boolean>;
    delete: (filePath: string) => Promise<boolean>;
    ensureDir: (dirPath: string) => Promise<boolean>;
  };
  shell: {
    /** Opens the file with the OS default app. Returns error message or empty string. */
    openPath: (filePath: string) => Promise<string>;
  };
};

const electronApi: ElectronApi = {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  store: {
    get: <T = unknown>(key: string) => ipcRenderer.invoke(IpcChannels.STORE_GET, key) as Promise<T | undefined>,
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(IpcChannels.STORE_SET, key, value) as Promise<boolean>,
    delete: (key: string) => ipcRenderer.invoke(IpcChannels.STORE_DELETE, key) as Promise<boolean>,
    clear: () => ipcRenderer.invoke(IpcChannels.STORE_CLEAR) as Promise<boolean>,
  },
  app: {
    getPath: (name: AppPathName) =>
      ipcRenderer.invoke(IpcChannels.APP_GET_PATH, name) as Promise<string>,
  },
  dialog: {
    openFile: (options) =>
      ipcRenderer.invoke(IpcChannels.DIALOG_OPEN_FILE, options) as Promise<string | null>,
    saveFile: (options) =>
      ipcRenderer.invoke(IpcChannels.DIALOG_SAVE_FILE, options) as Promise<string | null>,
  },
  file: {
    read: (filePath) => ipcRenderer.invoke(IpcChannels.FILE_READ, filePath) as Promise<FileReadResult>,
    readBinary: (filePath) =>
      ipcRenderer.invoke(IpcChannels.FILE_READ_BINARY, filePath) as Promise<FileReadBinaryResult>,
    write: (filePath, content) =>
      ipcRenderer.invoke(IpcChannels.FILE_WRITE, { path: filePath, content }) as Promise<boolean>,
    writeBinary: (filePath, base64) =>
      ipcRenderer.invoke(IpcChannels.FILE_WRITE_BINARY, { path: filePath, base64 }) as Promise<boolean>,
    exists: (filePath) => ipcRenderer.invoke(IpcChannels.FILE_EXISTS, filePath) as Promise<boolean>,
    delete: (filePath) => ipcRenderer.invoke(IpcChannels.FILE_DELETE, filePath) as Promise<boolean>,
    ensureDir: (dirPath) =>
      ipcRenderer.invoke(IpcChannels.FILE_ENSURE_DIR, dirPath) as Promise<boolean>,
  },
  shell: {
    openPath: (filePath) =>
      ipcRenderer.invoke(IpcChannels.SHELL_OPEN_PATH, filePath) as Promise<string>,
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronApi);
