export const StorageKeys = {
  SETTINGS: 'settings',
  RECENT_PROJECTS: 'recentProjects',
  LAST_OPENED_PROJECT_PATH: 'lastOpenedProjectPath',
  WINDOW_BOUNDS: 'windowBounds',
  DIRECTORY_PEOPLE: 'directoryPeople',
  DIRECTORY_APPLICATIONS: 'directoryApplications',
  DIRECTORY_MODULES: 'directoryModules',
  DIRECTORY_ENVIRONMENTS: 'directoryEnvironments',
  DIRECTORY_APPLICATIONS_SEEDED: 'directoryApplicationsSeeded',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
