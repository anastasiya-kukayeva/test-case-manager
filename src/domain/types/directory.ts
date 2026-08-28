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
};

/** Application name from the directory (справочник → Приложения). */
export type DirectoryApplication = {
  id: string;
  name: string;
  createdAt: string;
};

export function isDirectoryRole(value: unknown): value is DirectoryRole {
  return (
    typeof value === 'string' &&
    (DIRECTORY_ROLES as readonly string[]).includes(value)
  );
}
