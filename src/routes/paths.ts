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
