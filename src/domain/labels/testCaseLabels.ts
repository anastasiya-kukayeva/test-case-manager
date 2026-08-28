import type { TestCasePriority, TestCaseStatus, TestResultOutcome } from '@/domain/types';

export const TEST_CASE_STATUS_LABELS: Record<TestCaseStatus, string> = {
  draft: 'Черновик',
  ready: 'Готов',
  in_progress: 'В работе',
  passed: 'Пройден',
  failed: 'Провален',
  blocked: 'Заблокирован',
};

export const TEST_OUTCOME_LABELS: Record<Exclude<TestResultOutcome, null>, string> = {
  passed: 'Успешно',
  failed: 'Неуспешно',
};

export const TEST_OUTCOME_COLORS: Record<Exclude<TestResultOutcome, null>, string> = {
  passed: 'green',
  failed: 'red',
};

export const TEST_CASE_PRIORITY_LABELS: Record<TestCasePriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

export const TEST_CASE_STATUS_COLORS: Record<TestCaseStatus, string> = {
  draft: 'gray',
  ready: 'blue',
  in_progress: 'yellow',
  passed: 'green',
  failed: 'red',
  blocked: 'orange',
};

export const TEST_CASE_PRIORITY_COLORS: Record<TestCasePriority, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

export const TEST_CASE_STATUS_OPTIONS = (
  Object.entries(TEST_CASE_STATUS_LABELS) as Array<[TestCaseStatus, string]>
).map(([value, label]) => ({ value, label }));

export const TEST_CASE_PRIORITY_OPTIONS = (
  Object.entries(TEST_CASE_PRIORITY_LABELS) as Array<[TestCasePriority, string]>
).map(([value, label]) => ({ value, label }));
