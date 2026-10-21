import { AppError } from '@/application/errors/AppError';
import type { TaskDirectoryField } from '@/domain/utils/renameTaskDirectoryName';
import { renameTaskDirectoryName } from '@/domain/utils/renameTaskDirectoryName';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { recoveryService } from '@/infrastructure/project/recoveryService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

/** Write a renamed application or module into the open task and every known task file. */
export async function renameDirectoryNameInTasks(
  field: TaskDirectoryField,
  fromName: string,
  toName: string,
): Promise<void> {
  const nextName = toName.trim();
  if (!nextName || fromName.trim() === nextName) {
    return;
  }

  const current = useProjectStore.getState().current;
  const openNext = current && renameTaskDirectoryName(current.document, field, fromName, nextName);
  const openPath = current?.filePath ?? null;

  if (!projectFileService.isAvailable()) {
    if (openNext) {
      useProjectStore.getState().updateProjectMeta({ [field]: nextName });
    }
    return;
  }

  const seen = new Set<string>();
  if (openNext && current && openPath) {
    const savedPath = await projectFileService.saveToPath(openPath, openNext);
    useProjectStore.getState().setCurrentDocument(openNext, savedPath);
    if (recoveryService.isAvailable()) {
      await recoveryService.clear();
    }
    seen.add(savedPath);
    seen.add(openPath);
  }

  const failures: string[] = [];
  for (const recent of useAppStore.getState().recentProjects) {
    if (
      !recent.filePath ||
      recent.filePath.startsWith('__unsaved__') ||
      seen.has(recent.filePath)
    ) {
      continue;
    }
    seen.add(recent.filePath);
    try {
      const opened = await projectFileService.openFromPath(recent.filePath);
      const next = renameTaskDirectoryName(opened.document, field, fromName, nextName);
      if (!next) {
        continue;
      }
      await projectFileService.saveToPath(opened.filePath, next);
    } catch {
      failures.push(recent.filePath);
    }
  }

  if (failures.length > 0) {
    throw new AppError(
      'STORAGE_WRITE',
      `Не удалось обновить название в задачах: ${failures.length}`,
    );
  }

  if (openNext && !openPath) {
    useProjectStore.getState().updateProjectMeta({ [field]: nextName });
  }
}
