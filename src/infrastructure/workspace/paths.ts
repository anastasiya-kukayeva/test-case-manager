export function normalizeWorkspaceDirectory(value: string | null | undefined): string | null {
  const directory = value?.trim();
  return directory ? directory : null;
}

export function isPathInsideDirectory(filePath: string, directory: string): boolean {
  const normalize = (value: string) => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const file = normalize(filePath);
  const root = normalize(directory);
  if (!file || !root) {
    return false;
  }
  return file === root || file.startsWith(`${root}/`);
}

export function joinFsPath(directory: string, ...parts: string[]): string {
  const separator = directory.includes('\\') ? '\\' : '/';
  const segments = [directory.replace(/[/\\]+$/, '')];
  for (const part of parts) {
    const cleaned = part.replace(/^[/\\]+|[/\\]+$/g, '');
    if (cleaned) {
      segments.push(cleaned);
    }
  }
  return segments.join(separator);
}
