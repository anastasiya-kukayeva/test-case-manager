import { describe, expect, it } from 'vitest';
import {
  isPathInsideDirectory,
  joinFsPath,
  normalizeWorkspaceDirectory,
} from '@/infrastructure/workspace/paths';

describe('workspace paths', () => {
  it('treats a blank directory as unset', () => {
    expect(normalizeWorkspaceDirectory('   ')).toBeNull();
    expect(normalizeWorkspaceDirectory(null)).toBeNull();
    expect(normalizeWorkspaceDirectory(' D:\\tasks ')).toBe('D:\\tasks');
  });

  it('matches a file inside a directory regardless of slash style and case', () => {
    expect(isPathInsideDirectory('D:/Tasks/pay.tctask', 'd:\\tasks')).toBe(true);
    expect(isPathInsideDirectory('D:\\tasks', 'D:\\tasks\\')).toBe(true);
    expect(isPathInsideDirectory('D:\\tasks-other\\pay.tctask', 'D:\\tasks')).toBe(false);
    expect(isPathInsideDirectory('', 'D:\\tasks')).toBe(false);
  });

  it('joins segments with the separator already used by the directory', () => {
    expect(joinFsPath('D:\\tasks\\', 'Оплата', 'кейс.tctask')).toBe(
      'D:\\tasks\\Оплата\\кейс.tctask',
    );
    expect(joinFsPath('/tasks/', '/Оплата/')).toBe('/tasks/Оплата');
  });
});
