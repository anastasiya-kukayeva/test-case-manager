import { Center, Stack, Text } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import dayjs from 'dayjs';
import { useEffect, useState, type ReactNode } from 'react';
import { projectActions } from '@/application/project/projectActions';
import { RecoveryModal } from '@/components/project/RecoveryModal';
import { AppBootstrapSkeleton } from '@/components/ui/AppBootstrapSkeleton';
import { useProjectAutosave } from '@/hooks/useProjectAutosave';
import { useProjectHotkeys } from '@/hooks/useProjectHotkeys';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { recoveryService, type RecoverySnapshot } from '@/infrastructure/project/recoveryService';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useProjectStore } from '@/stores/useProjectStore';

type AppBootstrapProps = {
  children: ReactNode;
};

export function AppBootstrap({ children }: AppBootstrapProps) {
  const isInitialized = useAppStore((state) => state.isInitialized);
  const isLoading = useAppStore((state) => state.isLoading);
  const initialize = useAppStore((state) => state.initialize);
  const loadDirectory = useDirectoryStore((state) => state.load);
  const locale = useAppStore((state) => state.settings.locale);
  const rememberLastProject = useAppStore(
    (state) => state.settings.storage.rememberLastProject,
  );
  const [recoverySnapshot, setRecoverySnapshot] = useState<RecoverySnapshot | null>(null);
  const [recoveryChecked, setRecoveryChecked] = useState(false);

  useProjectAutosave();
  useProjectHotkeys();

  useEffect(() => {
    void initialize();
    void loadDirectory();
  }, [initialize, loadDirectory]);

  useEffect(() => {
    dayjs.locale(locale);
  }, [locale]);

  useEffect(() => {
    if (!isInitialized || recoveryChecked) {
      return;
    }

    void (async () => {
      try {
        if (recoveryService.isAvailable()) {
          const snapshot = await recoveryService.readSnapshot();
          if (snapshot) {
            setRecoverySnapshot(snapshot);
            return;
          }
        }

        if (
          rememberLastProject &&
          appStorageService.isAvailable() &&
          projectFileService.isAvailable() &&
          !useProjectStore.getState().current
        ) {
          const lastPath = await appStorageService.getLastOpenedProjectPath();
          if (lastPath) {
            const exists = await window.electronAPI?.file.exists(lastPath);
            if (exists) {
              await projectActions.openRecent(lastPath);
            }
          }
        }
      } finally {
        setRecoveryChecked(true);
      }
    })();
  }, [isInitialized, recoveryChecked, rememberLastProject]);

  if (!isInitialized || isLoading || !recoveryChecked) {
    return (
      <Center h="100vh">
        <Stack gap="md" w="100%">
          <Text ta="center" c="dimmed" size="sm">
            Загрузка приложения…
          </Text>
          <AppBootstrapSkeleton />
        </Stack>
      </Center>
    );
  }

  return (
    <DatesProvider settings={{ locale, firstDayOfWeek: 1 }}>
      {children}
      <RecoveryModal
        snapshot={recoverySnapshot}
        opened={recoverySnapshot !== null}
        onResolved={() => setRecoverySnapshot(null)}
      />
    </DatesProvider>
  );
}
