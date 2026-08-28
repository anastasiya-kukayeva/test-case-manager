import { useEffect } from 'react';
import { projectActions } from '@/application/project/projectActions';
import { AppRoutes } from '@/routes/paths';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUiStore } from '@/stores/useUiStore';
import { matchesHotkey } from '@/utils/hotkeys';

/**
 * Global shortcuts from settings: save / save-as / new test case / search.
 * Ctrl+O for open stays fixed (not in settings model).
 */
export function useProjectHotkeys(): void {
  const hasProject = useProjectStore((state) => state.current !== null);
  const hotkeys = useAppStore((state) => state.settings.hotkeys);
  const requestCreateTestCase = useUiStore((state) => state.requestCreateTestCase);
  const requestFocusSearch = useUiStore((state) => state.requestFocusSearch);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTypingTarget =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target?.isContentEditable);

      if (matchesHotkey(event, hotkeys.saveAs)) {
        event.preventDefault();
        if (hasProject) {
          void projectActions.saveAs();
        }
        return;
      }

      if (matchesHotkey(event, hotkeys.save)) {
        event.preventDefault();
        if (hasProject) {
          void projectActions.save();
        }
        return;
      }

      if (matchesHotkey(event, hotkeys.newTestCase)) {
        if (isTypingTarget) {
          return;
        }
        event.preventDefault();
        if (hasProject) {
          requestCreateTestCase();
          window.location.hash = `#${AppRoutes.testCases}`;
        }
        return;
      }

      if (matchesHotkey(event, hotkeys.search)) {
        // Do not steal Ctrl+F / search while the user is typing in a field or editor.
        if (isTypingTarget) {
          return;
        }
        event.preventDefault();
        if (hasProject) {
          window.location.hash = `#${AppRoutes.testCases}`;
          requestFocusSearch();
        }
        return;
      }

      const isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === 'o' && !event.shiftKey && !event.altKey) {
        if (isTypingTarget) {
          return;
        }
        event.preventDefault();
        void projectActions.open();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasProject, hotkeys, requestCreateTestCase, requestFocusSearch]);
}
