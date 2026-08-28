import { create } from 'zustand';
import {
  DEFAULT_TEST_CASE_FILTERS,
  type TestCaseFiltersState,
} from '@/application/testCases/filterTestCases';
import type { DateFilterState } from '@/application/testCases/datePresets';
import { DEFAULT_DATE_FILTER } from '@/application/testCases/datePresets';

export type TestCaseColumnId =
  | 'select'
  | 'number'
  | 'title'
  | 'createdAt'
  | 'updatedAt'
  | 'testOutcome'
  | 'actions';

export type ColumnVisibilityState = Record<string, boolean>;

type TestCaseTableUiState = {
  filters: TestCaseFiltersState;
  setSearch: (search: string) => void;
  setFilters: (partial: Partial<TestCaseFiltersState>) => void;
  setDateFilter: (partial: Partial<DateFilterState>) => void;
  clearFilters: () => void;
  columnVisibility: ColumnVisibilityState;
  setColumnVisibility: (visibility: ColumnVisibilityState) => void;
  columnSizing: Record<string, number>;
  setColumnSizing: (sizing: Record<string, number>) => void;
  columnPinning: { left: string[]; right: string[] };
  setColumnPinning: (pinning: { left: string[]; right: string[] }) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
};

const DEFAULT_VISIBILITY: ColumnVisibilityState = {
  select: true,
  number: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  testOutcome: true,
  actions: true,
};

export const useTestCaseTableStore = create<TestCaseTableUiState>((set, get) => ({
  filters: DEFAULT_TEST_CASE_FILTERS,
  setSearch: (search) => set({ filters: { ...get().filters, search } }),
  setFilters: (partial) => set({ filters: { ...get().filters, ...partial } }),
  setDateFilter: (partial) =>
    set({
      filters: {
        ...get().filters,
        date: {
          ...get().filters.date,
          ...partial,
        },
      },
    }),
  clearFilters: () =>
    set({
      filters: {
        ...DEFAULT_TEST_CASE_FILTERS,
        task: [],
        project: [],
        date: { ...DEFAULT_DATE_FILTER },
      },
    }),
  columnVisibility: DEFAULT_VISIBILITY,
  setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
  columnSizing: {},
  setColumnSizing: (sizing) => set({ columnSizing: sizing }),
  columnPinning: { left: ['select', 'number'], right: ['testOutcome', 'actions'] },
  setColumnPinning: (pinning) => set({ columnPinning: pinning }),
  pageSize: 10,
  setPageSize: (size) => set({ pageSize: size }),
}));
