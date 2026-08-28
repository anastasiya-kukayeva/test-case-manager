import { sortBy, uniq } from 'lodash-es';
import type { TestCase, TestCasePriority, TestCaseStatus } from '@/domain/types';
import {
  DEFAULT_DATE_FILTER,
  matchesDateFilter,
  type DateFilterState,
} from '@/application/testCases/datePresets';

export type TestCaseTableRow = TestCase & {
  taskName: string;
  /** @deprecated use taskName */
  projectName: string;
};

export type TestCaseFiltersState = {
  search: string;
  task: string[];
  /** @deprecated use task */
  project: string[];
  section: string[];
  module: string[];
  author: string[];
  priority: TestCasePriority[];
  status: TestCaseStatus[];
  date: DateFilterState;
};

export const DEFAULT_TEST_CASE_FILTERS: TestCaseFiltersState = {
  search: '',
  task: [],
  project: [],
  section: [],
  module: [],
  author: [],
  priority: [],
  status: [],
  date: DEFAULT_DATE_FILTER,
};

function includesIgnoreCase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function toTestCaseRows(testCases: TestCase[], taskName: string): TestCaseTableRow[] {
  return testCases.map((testCase) => ({
    ...testCase,
    taskName,
    projectName: taskName,
  }));
}

export function filterTestCases(
  rows: TestCaseTableRow[],
  filters: TestCaseFiltersState,
): TestCaseTableRow[] {
  const search = filters.search.trim();
  const taskFilter = filters.task.length > 0 ? filters.task : filters.project;

  return rows.filter((row) => {
    if (search) {
      const searchable = [
        row.number,
        row.title,
        row.taskName,
        row.section,
        row.module,
        row.author,
        row.developer,
        row.businessAnalyst,
        row.id,
      ];
      const matched = searchable.some((field) => includesIgnoreCase(field, search));
      if (!matched) {
        return false;
      }
    }

    if (taskFilter.length > 0 && !taskFilter.includes(row.taskName)) {
      return false;
    }
    if (filters.section.length > 0 && !filters.section.includes(row.section)) {
      return false;
    }
    if (filters.module.length > 0 && !filters.module.includes(row.module)) {
      return false;
    }
    if (filters.author.length > 0 && !filters.author.includes(row.author)) {
      return false;
    }
    if (filters.priority.length > 0 && !filters.priority.includes(row.priority)) {
      return false;
    }
    if (filters.status.length > 0 && !filters.status.includes(row.status)) {
      return false;
    }

    const dateValue = filters.date.field === 'createdAt' ? row.createdAt : row.updatedAt;
    if (!matchesDateFilter(dateValue, filters.date)) {
      return false;
    }

    return true;
  });
}

export function collectUniqueValues(rows: TestCaseTableRow[], key: keyof TestCaseTableRow): string[] {
  const values = rows
    .map((row) => row[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return sortBy(uniq(values), (value) => value.toLocaleLowerCase('ru'));
}
