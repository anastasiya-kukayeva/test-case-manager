import Store from 'electron-store';

export type ElectronStoreSchema = {
  settings: Record<string, unknown>;
  recentProjects: Array<{
    id: string;
    name: string;
    shortName?: string;
    filePath: string;
    openedAt: string;
    parentTaskId?: string | null;
  }>;
  lastOpenedProjectPath: string | null;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  } | null;
  recoveryMeta: {
    originalFilePath: string | null;
    projectName: string;
    savedAt: string;
  } | null;
  directoryPeople: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  directoryApplications: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
};

const defaultSettings = {
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

export const electronStore = new Store<ElectronStoreSchema>({
  name: 'test-case-manager',
  defaults: {
    settings: defaultSettings,
    recentProjects: [],
    lastOpenedProjectPath: null,
    windowBounds: null,
    recoveryMeta: null,
    directoryPeople: [],
    directoryApplications: [],
  },
});
