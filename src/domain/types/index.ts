export type { TestAttachment, ImageAttachment, CodeAttachment, LogAttachment } from '@/domain/types/attachment';
export type {
  TestCaseStatus,
  TestCasePriority,
  TestResultOutcome,
  AttachmentKind,
  CodeLanguage,
} from '@/domain/types/enums';
export type {
  TestCase,
  TestCaseSummary,
  RichTextContent,
} from '@/domain/types/testCase';
export { isMarkedForRegression } from '@/domain/types/testCase';
export type {
  TaskDocument,
  TaskMeta,
  RecentTask,
  OpenTaskState,
  ProjectDocument,
  ProjectMeta,
  RecentProject,
  OpenProjectState,
  NamedLink,
} from '@/domain/types/task';
export {
  TC_TASK_FILE_EXTENSION,
  TC_TASK_FILE_EXTENSION_LEGACY,
  TC_TASK_MIME,
  TC_TASK_FORMAT_VERSION,
  TC_PROJECT_FILE_EXTENSION,
  TC_PROJECT_MIME,
  TC_PROJECT_FORMAT_VERSION,
} from '@/domain/types/task';
export type { AppSettings, AutosaveSettings, StorageSettings, ExportSettings, HotkeySettings } from '@/domain/types/settings';
export { DEFAULT_APP_SETTINGS } from '@/domain/types/settings';
export type {
  DirectoryPerson,
  DirectoryRole,
  DirectoryApplication,
  DirectoryModule,
  DirectoryEnvironment,
} from '@/domain/types/directory';
export { DIRECTORY_ROLES, DIRECTORY_ROLE_LABELS, isDirectoryRole } from '@/domain/types/directory';
