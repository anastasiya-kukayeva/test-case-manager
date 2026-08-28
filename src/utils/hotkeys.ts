import type { HotkeySettings } from '@/domain/types';

export type ParsedHotkey = {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
};

/** Parses strings like "Ctrl+S", "Ctrl+Shift+S", "Ctrl+N". */
export function parseHotkey(shortcut: string): ParsedHotkey | null {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const keyRaw = parts[parts.length - 1];
  if (!keyRaw) {
    return null;
  }

  const modifiers = parts.slice(0, -1).map((part) => part.toLowerCase());
  const key = keyRaw.length === 1 ? keyRaw.toLowerCase() : keyRaw.toLowerCase();

  return {
    key,
    ctrl: modifiers.includes('ctrl') || modifiers.includes('control'),
    shift: modifiers.includes('shift'),
    alt: modifiers.includes('alt'),
    meta: modifiers.includes('meta') || modifiers.includes('cmd') || modifiers.includes('command'),
  };
}

export function matchesHotkey(event: KeyboardEvent, shortcut: string): boolean {
  const parsed = parseHotkey(shortcut);
  if (!parsed) {
    return false;
  }

  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  const wantsMod = parsed.ctrl || parsed.meta;
  const hasMod = event.ctrlKey || event.metaKey;

  if (wantsMod !== hasMod) {
    return false;
  }

  if (parsed.shift !== event.shiftKey) {
    return false;
  }

  if (parsed.alt !== event.altKey) {
    return false;
  }

  return eventKey === parsed.key;
}

export function isValidHotkey(shortcut: string): boolean {
  return parseHotkey(shortcut) !== null && shortcut.includes('+');
}

export const HOTKEY_FIELD_LABELS: Record<keyof HotkeySettings, string> = {
  save: 'Сохранить',
  saveAs: 'Сохранить как',
  newTestCase: 'Новый тест-кейс',
  search: 'Поиск',
};
