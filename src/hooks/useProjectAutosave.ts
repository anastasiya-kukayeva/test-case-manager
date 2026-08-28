import { useEffect, useRef } from 'react';
import { projectActions } from '@/application/project/projectActions';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

/**
 * Writes a crash-recovery snapshot soon after edits.
 * When autosave is enabled and the task has a file path, also silently saves *.tctask.
 * Leaving a task / test case always saves via projectActions.saveIfDirty (no prompts).
 */
export function useProjectAutosave(): void {
  const enabled = useAppStore((state) => state.settings.autosave.enabled);
  const intervalSeconds = useAppStore((state) => state.settings.autosave.intervalSeconds);
  const isDirty = useProjectStore((state) => state.current?.isDirty ?? false);
  const filePath = useProjectStore((state) => state.current?.filePath ?? null);
  const updatedAt = useProjectStore((state) => state.current?.document.meta.updatedAt ?? null);
  const intervalRef = useRef<number | null>(null);
  const debounceRef = useRef<number | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!isDirty) {
      return;
    }

    // Always flush recovery + task file shortly after edits (no prompts).
    debounceRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await projectActions.writeAutosaveSnapshot();
          await projectActions.saveIfDirty({ silent: true });
        } catch (error) {
          console.error('Autosave failed', error);
        }
      })();
    }, 800);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [isDirty, updatedAt]);

  useEffect(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled || !isDirty) {
      return;
    }

    const intervalMs = Math.max(5, intervalSeconds) * 1000;

    intervalRef.current = window.setInterval(() => {
      void (async () => {
        if (savingRef.current) {
          return;
        }

        try {
          savingRef.current = true;
          await projectActions.writeAutosaveSnapshot();

          const current = useProjectStore.getState().current;
          if (!current?.filePath || !current.isDirty || !projectFileService.isAvailable()) {
            return;
          }

          const path = current.filePath;
          const documentToSave = current.document;
          const savedUpdatedAt = documentToSave.meta.updatedAt;

          await projectFileService.saveToPath(path, documentToSave);

          // Only clear dirty if nothing newer was edited during the async save.
          const after = useProjectStore.getState().current;
          if (
            after &&
            after.filePath === path &&
            after.document.meta.updatedAt === savedUpdatedAt
          ) {
            useProjectStore.getState().markSaved(path);
            await projectActions.discardRecovery();
          }
        } catch (error) {
          console.error('Autosave failed', error);
        } finally {
          savingRef.current = false;
        }
      })();
    }, intervalMs);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, intervalSeconds, isDirty, filePath]);
}
