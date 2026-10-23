import { separateDuplicateTaskFiles } from '@/application/project/separateDuplicateTaskFiles';
import { invalidateWorkspaceBinding } from '@/infrastructure/storage/appStorageService';
import { normalizeWorkspaceDirectory } from '@/infrastructure/workspace/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';

/** Re-read tasks from the working folder. No-op when the folder is not set. */
export async function syncWorkspaceTasks(): Promise<void> {
  const directory = normalizeWorkspaceDirectory(
    useAppStore.getState().settings.storage.defaultProjectsDirectory,
  );
  if (!directory) {
    return;
  }
  await useAppStore.getState().refreshRecentProjects();
  await separateDuplicateTaskFiles();
}

/** Reload tasks and directories after the working folder changes or settings reset. */
export async function reloadWorkspaceBoundData(): Promise<boolean> {
  invalidateWorkspaceBinding();
  const tasksLoaded = await useAppStore.getState().refreshRecentProjects();
  await separateDuplicateTaskFiles();
  await useDirectoryStore.getState().load();
  return tasksLoaded;
}
