import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import type { ReactNode } from 'react';
import { HashRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AppBootstrap } from '@/providers/AppBootstrap';

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ErrorBoundary title="Критическая ошибка приложения">
      <HashRouter>
        <ModalsProvider
          labels={{
            confirm: 'Подтвердить',
            cancel: 'Отмена',
          }}
        >
          <Notifications position="top-right" zIndex={4000} />
          <AppBootstrap>{children}</AppBootstrap>
        </ModalsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
