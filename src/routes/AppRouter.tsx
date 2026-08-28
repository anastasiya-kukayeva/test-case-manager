import { Center, Loader, Stack, Text } from '@mantine/core';
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { TablePageSkeleton } from '@/components/ui/AppBootstrapSkeleton';
import { AppLayout } from '@/layouts/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { TasksListPage } from '@/pages/TasksListPage';
import { AppRoutes } from '@/routes/paths';

const AllTestCasesPage = lazy(async () => {
  const module = await import('@/pages/AllTestCasesPage');
  return { default: module.AllTestCasesPage };
});

const TestCasesPage = lazy(async () => {
  const module = await import('@/pages/TestCasesPage');
  return { default: module.TestCasesPage };
});

const TestCaseEditorPage = lazy(async () => {
  const module = await import('@/pages/TestCaseEditorPage');
  return { default: module.TestCaseEditorPage };
});

const SettingsPage = lazy(async () => {
  const module = await import('@/pages/SettingsPage');
  return { default: module.SettingsPage };
});

const DirectoryPage = lazy(async () => {
  const module = await import('@/pages/DirectoryPage');
  return { default: module.DirectoryPage };
});

const ApplicationsPage = lazy(async () => {
  const module = await import('@/pages/ApplicationsPage');
  return { default: module.ApplicationsPage };
});

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<TablePageSkeleton />}>{children}</Suspense>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path={AppRoutes.tasks} element={<TasksListPage />} />
        <Route path={AppRoutes.taskCurrent} element={<TaskDetailPage />} />
        <Route
          path={AppRoutes.allTestCases}
          element={
            <LazyPage>
              <AllTestCasesPage />
            </LazyPage>
          }
        />
        <Route
          path={AppRoutes.testCases}
          element={
            <LazyPage>
              <TestCasesPage />
            </LazyPage>
          }
        />
        <Route
          path="/tasks/test-cases/:id"
          element={
            <LazyPage>
              <TestCaseEditorPage />
            </LazyPage>
          }
        />
        <Route
          path={AppRoutes.applications}
          element={
            <LazyPage>
              <ApplicationsPage />
            </LazyPage>
          }
        />
        <Route
          path={AppRoutes.directory}
          element={
            <LazyPage>
              <DirectoryPage />
            </LazyPage>
          }
        />
        <Route
          path={AppRoutes.settings}
          element={
            <LazyPage>
              <SettingsPage />
            </LazyPage>
          }
        />
        <Route path="/projects" element={<Navigate to={AppRoutes.tasks} replace />} />
        <Route path="/home" element={<Navigate to={AppRoutes.home} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

/** Kept for typed imports if needed elsewhere */
export function RouterFallback() {
  return (
    <Center h={240}>
      <Stack align="center" gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Загрузка…
        </Text>
      </Stack>
    </Center>
  );
}
