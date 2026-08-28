/// <reference types="vite/client" />

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
    getPath: (name: 'userData' | 'documents' | 'home' | 'temp') => Promise<string>;
  };
  dialog: {
    openFile: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
    }) => Promise<string | null>;
    saveFile: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<string | null>;
  };
  file: {
    read: (filePath: string) => Promise<{ path: string; content: string }>;
    readBinary: (filePath: string) => Promise<{ path: string; base64: string }>;
    write: (filePath: string, content: string) => Promise<boolean>;
    writeBinary: (filePath: string, base64: string) => Promise<boolean>;
    exists: (filePath: string) => Promise<boolean>;
    delete: (filePath: string) => Promise<boolean>;
    ensureDir: (dirPath: string) => Promise<boolean>;
  };
  shell: {
    openPath: (filePath: string) => Promise<string>;
  };
};

declare global {
  const __APP_VERSION__: string;

  interface Window {
    electronAPI?: ElectronApi;
  }
}

export {};
