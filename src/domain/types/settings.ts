export type AutosaveSettings = {
  enabled: boolean;
  intervalSeconds: number;
};

export type StorageSettings = {
  defaultProjectsDirectory: string | null;
  rememberLastProject: boolean;
};

export type ExportSettings = {
  includeImages: boolean;
  includeCodeBlocks: boolean;
  includeLogs: boolean;
};

export type HotkeySettings = {
  save: string;
  saveAs: string;
  newTestCase: string;
  search: string;
};

export type AppSettings = {
  autosave: AutosaveSettings;
  storage: StorageSettings;
  export: ExportSettings;
  hotkeys: HotkeySettings;
  locale: 'ru' | 'en';
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  autosave: {
    enabled: true,
    intervalSeconds: 30,
  },
  storage: {
    defaultProjectsDirectory: null,
    rememberLastProject: true,
  },
  export: {
    includeImages: true,
    includeCodeBlocks: true,
    includeLogs: true,
  },
  hotkeys: {
    save: 'Ctrl+S',
    saveAs: 'Ctrl+Shift+S',
    newTestCase: 'Ctrl+N',
    search: 'Ctrl+F',
  },
  locale: 'ru',
};
