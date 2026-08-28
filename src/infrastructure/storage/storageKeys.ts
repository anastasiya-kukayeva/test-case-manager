export const StorageKeys = {
  SETTINGS: 'settings',
  RECENT_PROJECTS: 'recentProjects',
  LAST_OPENED_PROJECT_PATH: 'lastOpenedProjectPath',
  WINDOW_BOUNDS: 'windowBounds',
  DIRECTORY_PEOPLE: 'directoryPeople',
  DIRECTORY_APPLICATIONS: 'directoryApplications',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
