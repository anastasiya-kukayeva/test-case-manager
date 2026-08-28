export const AppRoutes = {
  home: '/',
  tasks: '/tasks',
  taskCurrent: '/tasks/current',
  /** @deprecated use tasks */
  projects: '/tasks',
  /** All test cases across recent tasks */
  allTestCases: '/test-cases',
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
