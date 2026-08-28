import { Alert, AppShell, Code, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { AnimatePresence } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PageTransition } from '@/components/ui/PageTransition';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { AppFooter } from '@/layouts/AppFooter';
import { AppHeader } from '@/layouts/AppHeader';
import { AppSidebar } from '@/layouts/AppSidebar';
import { useUiStore } from '@/stores/useUiStore';

function isElectronShell(): boolean {
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
}

export function AppLayout() {
  const sidebarOpened = useUiStore((state) => state.sidebarOpened);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const location = useLocation();
  const hasDesktopApi = projectFileService.isAvailable();
  const inElectronShell = isElectronShell();

  return (
    <AppShell
      header={{ height: 56 }}
      footer={{ height: 36 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { desktop: !sidebarOpened, mobile: !sidebarOpened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <AppHeader onToggleSidebar={toggleSidebar} />
      </AppShell.Header>

      <AppShell.Navbar>
        <AppSidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        {!hasDesktopApi ? (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title={
              inElectronShell
                ? 'Не удалось подключить файловый API Electron'
                : 'Приложение открыто в браузере'
            }
            color="red"
            mb="md"
          >
            {inElectronShell ? (
              <Text size="sm">
                Окно Electron запущено, но preload-скрипт не активен. Полностью закройте приложение
                и снова выполните <Code>npm run dev</Code>.
              </Text>
            ) : (
              <Text size="sm">
                Открытие и сохранение задач работают только в окне Electron. Закройте вкладку
                браузера и запустите <Code>npm run dev</Code> — работайте в окне «Test Case
                Manager», а не на http://localhost:5173.
              </Text>
            )}
          </Alert>
        ) : null}
        <ErrorBoundary title="Ошибка на странице">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </ErrorBoundary>
      </AppShell.Main>

      <AppShell.Footer>
        <AppFooter />
      </AppShell.Footer>
    </AppShell>
  );
}
