import { nanoid } from 'nanoid';
import { notifyError } from '@/application/errors/errorHandler';
import { duplicateTaskFilesToReassign, sameFilePath } from '@/application/project/taskListIdentity';
import type { TaskDocument } from '@/domain/types';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

function patchListedId(filePath: string, id: string): void {
  const recent = useAppStore.getState().recentProjects;
  useAppStore.getState().setRecentProjects(
    recent.map((item) => (sameFilePath(item.filePath, filePath) ? { ...item, id } : item)),
  );
}

function withNewId(document: TaskDocument, id: string): TaskDocument {
  return {
    ...document,
    meta: {
      ...document.meta,
      id,
    },
  };
}

async function reassignTaskFile(filePath: string): Promise<void> {
  const newId = nanoid();
  const current = useProjectStore.getState().current;
  const openHere = Boolean(current?.filePath && sameFilePath(current.filePath, filePath));

  if (openHere && current?.isDirty) {
    useProjectStore.getState().updateDocument(withNewId(current.document, newId));
    patchListedId(filePath, newId);
    return;
  }

  const opened = await projectFileService.openFromPath(filePath);
  const document = withNewId(opened.document, newId);
  await projectFileService.saveToPath(filePath, document);
  if (openHere && current) {
    useProjectStore.getState().setCurrentDocument(document, current.filePath);
  }
  patchListedId(filePath, newId);
}

/** Give each extra file that still carries another task's id its own id. Names stay. */
export async function separateDuplicateTaskFiles(): Promise<void> {
  if (!projectFileService.isAvailable()) {
    return;
  }

  const targets = duplicateTaskFilesToReassign(useAppStore.getState().recentProjects);
  for (const filePath of targets) {
    try {
      await reassignTaskFile(filePath);
    } catch (error) {
      notifyError(error, { title: 'Не удалось отделить копию задачи' });
    }
  }
}
