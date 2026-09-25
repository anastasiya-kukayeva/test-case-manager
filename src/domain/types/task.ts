import type { RichTextContent, TestCase } from '@/domain/types/testCase';

/** Primary file extension for tasks */
export const TC_TASK_FILE_EXTENSION = 'tctask';
/** Legacy extension (formerly "project") */
export const TC_TASK_FILE_EXTENSION_LEGACY = 'tcproj';
export const TC_TASK_MIME = 'application/x-testcase-manager-task';
export const TC_TASK_FORMAT_VERSION = 1;

export type RecentTask = {
  id: string;
  name: string;
  /** Short label for sidebar; may be missing in older entries */
  shortName?: string;
  filePath: string;
  openedAt: string;
  /** Parent task id when this task is nested under another */
  parentTaskId?: string | null;
};

/** Named external link for «Объект испытаний». */
export type NamedLink = {
  id: string;
  title: string;
  url: string;
};

export type TaskMeta = {
  id: string;
  name: string;
  /** Short label for sidebar / lists */
  shortName: string;
  /** Release number shown on the Word title page */
  releaseNumber: string;
  /** @deprecated kept for backward compatibility with older *.tctask files */
  description: string;
  /** @deprecated kept for backward compatibility with older *.tctask files */
  author: string;
  /** Объект испытаний — свободный текст */
  testObject: string;
  /** Ссылки объекта испытаний: отображаемое имя + URL */
  testObjectLinks: NamedLink[];
  /** Приложение из справочника (название) */
  application: string;
  /** Модуль из справочника (название) */
  module: string;
  /** Цель испытаний — rich text со списками */
  testGoal: RichTextContent;
  /** Общие положения */
  generalProvisions: string;
  /** Требования к функциональности — rich text со списками */
  functionalRequirements: RichTextContent;
  /** Риски и ограничения — rich text со списками */
  risksAndLimitations: RichTextContent;
  createdAt: string;
  updatedAt: string;
  /** Parent task id when this task is nested under another */
  parentTaskId?: string | null;
};

/**
 * A Task owns its test cases and may nest under another task.
 * Hierarchy: Task → Task[] (subtasks) → TestCase[]
 */
export type TaskDocument = {
  formatVersion: typeof TC_TASK_FORMAT_VERSION;
  meta: TaskMeta;
  testCases: TestCase[];
};

export type OpenTaskState = {
  document: TaskDocument;
  filePath: string | null;
  isDirty: boolean;
  lastSavedAt: string | null;
};

// Backward-compatible aliases (old "project" naming)
export const TC_PROJECT_FILE_EXTENSION = TC_TASK_FILE_EXTENSION_LEGACY;
export const TC_PROJECT_MIME = TC_TASK_MIME;
export const TC_PROJECT_FORMAT_VERSION = TC_TASK_FORMAT_VERSION;
export type RecentProject = RecentTask;
export type ProjectMeta = TaskMeta;
export type ProjectDocument = TaskDocument;
export type OpenProjectState = OpenTaskState;
