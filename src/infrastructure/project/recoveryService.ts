import { AppError } from '@/application/errors/AppError';
import type { ProjectDocument } from '@/domain/types';
import {
  parseProjectFileContent,
  serializeProjectDocument,
} from '@/infrastructure/project/tcprojFormat';

export type RecoverySnapshot = {
  document: ProjectDocument;
  originalFilePath: string | null;
  savedAt: string;
};

const RECOVERY_DIR_NAME = 'recovery';
const RECOVERY_FILE_NAME = 'unsaved.tcproj.recovery';
const RECOVERY_META_KEY = 'recoveryMeta';

type RecoveryMeta = {
  originalFilePath: string | null;
  projectName: string;
  savedAt: string;
};

function requireApi() {
  const api = window.electronAPI;
  if (!api?.file || !api.app || !api.store) {
    throw new AppError('IPC_UNAVAILABLE', 'Recovery недоступен вне Electron');
  }
  return api;
}

async function getRecoveryFilePath(): Promise<string> {
  const api = requireApi();
  const userData = await api.app.getPath('userData');
  // Use forward/backslash agnostic join via string concat with platform separator from path-like
  const separator = userData.includes('\\') ? '\\' : '/';
  const dir = `${userData}${separator}${RECOVERY_DIR_NAME}`;
  await api.file.ensureDir(dir);
  return `${dir}${separator}${RECOVERY_FILE_NAME}`;
}

export const recoveryService = {
  isAvailable(): boolean {
    return Boolean(window.electronAPI?.file && window.electronAPI?.app && window.electronAPI?.store);
  },

  async writeSnapshot(document: ProjectDocument, originalFilePath: string | null): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const api = requireApi();
    const recoveryPath = await getRecoveryFilePath();
    const content = serializeProjectDocument(document);
    await api.file.write(recoveryPath, content);

    const meta: RecoveryMeta = {
      originalFilePath,
      projectName: document.meta.name,
      savedAt: new Date().toISOString(),
    };
    await api.store.set(RECOVERY_META_KEY, meta);
  },

  async readSnapshot(): Promise<RecoverySnapshot | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const api = requireApi();
    const recoveryPath = await getRecoveryFilePath();
    const exists = await api.file.exists(recoveryPath);
    if (!exists) {
      return null;
    }

    try {
      const { content } = await api.file.read(recoveryPath);
      const document = parseProjectFileContent(content);
      const meta = (await api.store.get<RecoveryMeta>(RECOVERY_META_KEY)) ?? null;

      return {
        document,
        originalFilePath: meta?.originalFilePath ?? null,
        savedAt: meta?.savedAt ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const api = requireApi();
    const recoveryPath = await getRecoveryFilePath();
    await api.file.delete(recoveryPath);
    await api.store.delete(RECOVERY_META_KEY);
  },

  async hasSnapshot(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const api = requireApi();
    const recoveryPath = await getRecoveryFilePath();
    return api.file.exists(recoveryPath);
  },
};
