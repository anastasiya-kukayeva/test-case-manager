export const DIRECTORY_ROLES = ['author', 'developer', 'businessAnalyst'] as const;

export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

export const DIRECTORY_ROLE_LABELS: Record<DirectoryRole, string> = {
  author: 'Автор',
  developer: 'Разработчик',
  businessAnalyst: 'Бизнес-аналитик',
};

export type DirectoryPerson = {
  id: string;
  name: string;
  role: DirectoryRole;
  createdAt: string;
  /** Default author used when a new task or test case is created. */
  isDefault?: boolean;
};

/** Application name from the directory (справочник → Приложение). */
export type DirectoryApplication = {
  id: string;
  name: string;
  createdAt: string;
};

/** Module name from the directory (справочник → Модуль). */
export type DirectoryModule = {
  id: string;
  name: string;
  createdAt: string;
};

/** Environment name from the directory (справочник → Среды). */
export type DirectoryEnvironment = {
  id: string;
  name: string;
  createdAt: string;
  /** Default environment. */
  isDefault?: boolean;
};

export function isDirectoryRole(value: unknown): value is DirectoryRole {
  return (
    typeof value === 'string' &&
    (DIRECTORY_ROLES as readonly string[]).includes(value)
  );
}
