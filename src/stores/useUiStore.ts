import { create } from 'zustand';

type UiStoreState = {
  sidebarOpened: boolean;
  setSidebarOpened: (opened: boolean) => void;
  toggleSidebar: () => void;
  globalBusy: boolean;
  setGlobalBusy: (busy: boolean) => void;
  lastErrorMessage: string | null;
  setLastErrorMessage: (message: string | null) => void;
  createTestCaseRequestId: number;
  requestCreateTestCase: () => void;
  focusSearchRequestId: number;
  requestFocusSearch: () => void;
  /** Expanded parent task ids on the tasks list; survives opening a task and coming back. */
  taskListExpandedIds: string[];
  setTaskListExpandedIds: (ids: string[] | ((current: string[]) => string[])) => void;
  /** Last regression tab per list (`modules` or the unassigned tab), kept across the case editor. */
  regressionListTab: Partial<Record<'suite' | 'task', string>>;
  setRegressionListTab: (mode: 'suite' | 'task', tab: string) => void;
  /** Module names left open in the regression list, kept across the case editor. */
  regressionExpandedModules: Partial<Record<'suite' | 'task', string[]>>;
  setRegressionExpandedModules: (mode: 'suite' | 'task', names: string[]) => void;
};

export const useUiStore = create<UiStoreState>((set, get) => ({
  sidebarOpened: true,
  setSidebarOpened: (opened) => set({ sidebarOpened: opened }),
  toggleSidebar: () => set({ sidebarOpened: !get().sidebarOpened }),
  globalBusy: false,
  setGlobalBusy: (busy) => set({ globalBusy: busy }),
  lastErrorMessage: null,
  setLastErrorMessage: (message) => set({ lastErrorMessage: message }),
  createTestCaseRequestId: 0,
  requestCreateTestCase: () =>
    set({ createTestCaseRequestId: get().createTestCaseRequestId + 1 }),
  focusSearchRequestId: 0,
  requestFocusSearch: () => set({ focusSearchRequestId: get().focusSearchRequestId + 1 }),
  taskListExpandedIds: [],
  setTaskListExpandedIds: (ids) =>
    set((state) => ({
      taskListExpandedIds: typeof ids === 'function' ? ids(state.taskListExpandedIds) : ids,
    })),
  regressionListTab: {},
  setRegressionListTab: (mode, tab) =>
    set((state) => ({
      regressionListTab: { ...state.regressionListTab, [mode]: tab },
    })),
  regressionExpandedModules: {},
  setRegressionExpandedModules: (mode, names) =>
    set((state) => ({
      regressionExpandedModules: { ...state.regressionExpandedModules, [mode]: names },
    })),
}));
