export const IpcChannels = {
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
  STORE_DELETE: 'store:delete',
  STORE_CLEAR: 'store:clear',
  APP_GET_PATH: 'app:get-path',
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  FILE_READ: 'file:read',
  FILE_READ_BINARY: 'file:read-binary',
  FILE_WRITE: 'file:write',
  FILE_WRITE_BINARY: 'file:write-binary',
  FILE_EXISTS: 'file:exists',
  FILE_DELETE: 'file:delete',
  FILE_ENSURE_DIR: 'file:ensure-dir',
  SHELL_OPEN_PATH: 'shell:open-path',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export type AppPathName = 'userData' | 'documents' | 'home' | 'temp';

export type OpenFileDialogOptions = {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
};

export type SaveFileDialogOptions = {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
};

export type FileReadResult = {
  path: string;
  content: string;
};

export type FileReadBinaryResult = {
  path: string;
  base64: string;
};

export type FileWriteRequest = {
  path: string;
  content: string;
};

export type FileWriteBinaryRequest = {
  path: string;
  base64: string;
};
