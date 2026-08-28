import { ListItem } from '@tiptap/extension-list';
import type { ResolvedPos } from '@tiptap/pm/model';

export const MAX_BULLET_LIST_DEPTH = 5;

/** Markers for nesting levels 0..4 (• ○ ▪ ▫ ▸). */
export const BULLET_MARKERS = ['•', '○', '▪', '▫', '▸'] as const;

export function bulletMarkerForDepth(depth: number): string {
  const index = Math.max(0, Math.min(BULLET_MARKERS.length - 1, depth));
  return BULLET_MARKERS[index];
}

function getListItemNestingLevel($from: ResolvedPos, listItemName: string): number {
  let nestingLevel = 0;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === listItemName) {
      nestingLevel += 1;
    }
  }
  return nestingLevel;
}

/**
 * ListItem with Tab / Shift-Tab nesting, capped at 5 levels for bullet/ordered lists.
 */
export const NestedListItem = ListItem.extend({
  name: 'listItem',
  priority: 110,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'tcm-list-item',
      },
      bulletListTypeName: 'bulletList',
      orderedListTypeName: 'orderedList',
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => {
        if (!this.editor.isActive(this.name)) {
          return false;
        }
        const { $from } = this.editor.state.selection;
        const nestingLevel = getListItemNestingLevel($from, this.name);
        if (nestingLevel >= MAX_BULLET_LIST_DEPTH) {
          return true;
        }
        if (this.editor.can().sinkListItem(this.name)) {
          return this.editor.commands.sinkListItem(this.name);
        }
        // Keep focus in the editor when Tab cannot nest (e.g. first item).
        return true;
      },
      'Shift-Tab': () => {
        if (!this.editor.isActive(this.name)) {
          return false;
        }
        if (this.editor.can().liftListItem(this.name)) {
          return this.editor.commands.liftListItem(this.name);
        }
        return true;
      },
    };
  },
});

export function canSinkListItem(editor: {
  state: { selection: { $from: ResolvedPos } };
  can: () => { sinkListItem: (name: string) => boolean };
}): boolean {
  const nestingLevel = getListItemNestingLevel(editor.state.selection.$from, 'listItem');
  if (nestingLevel >= MAX_BULLET_LIST_DEPTH) {
    return false;
  }
  return editor.can().sinkListItem('listItem');
}
