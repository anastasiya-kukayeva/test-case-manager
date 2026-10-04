export const AppRoutes = {
  home: '/',
  tasks: '/tasks',
  taskCurrent: '/tasks/current',
  /** @deprecated use tasks */
  projects: '/tasks',
  /** All test cases across recent tasks */
  allTestCases: '/test-cases',
  /** Regression entry: two lists */
  regression: '/regression',
  /** Application → module → task browser for one regression list */
  regressionBrowse: '/regression/browse/:mode',
  /** Regression cases of the currently open task */
  regressionCases: '/regression/cases',
  testCases: '/tasks/test-cases',
  testCaseEditor: '/tasks/test-cases/:id',
  applications: '/applications',
  directory: '/directory',
  settings: '/settings',
} as const;

export type AppRoutePath = (typeof AppRoutes)[keyof typeof AppRoutes];

export function testCaseEditorPath(id: string): string {
  return `/tasks/test-cases/${id}`;
}

export function regressionBrowsePath(mode: 'suite' | 'task'): string {
  return `/regression/browse/${mode}`;
}

/** All regression cases of one module. */
export function regressionModuleCasesPath(mode: 'suite' | 'task', moduleName: string): string {
  return `/regression/browse/${mode}/module/${encodeURIComponent(moduleName)}`;
}

/** Regression cases of one task. */
export function regressionTaskCasesPath(mode: 'suite' | 'task', taskId: string): string {
  return `/regression/browse/${mode}/task/${encodeURIComponent(taskId)}`;
}
