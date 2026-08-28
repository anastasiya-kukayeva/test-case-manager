import { MantineProvider } from '@mantine/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { useColorSchemePreference } from '@/hooks/useColorSchemePreference';
import { AppProviders } from '@/providers/AppProviders';
import { appTheme } from '@/theme';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/tiptap/styles.css';
import 'dayjs/locale/ru';
import 'dayjs/locale/en';
import '@/styles/global.css';

function Root() {
  const { colorScheme } = useColorSchemePreference();

  return (
    <MantineProvider theme={appTheme} defaultColorScheme={colorScheme}>
      <AppProviders>
        <App />
      </AppProviders>
    </MantineProvider>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
