import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';

export type FenceKind = 'code' | 'log';

function fenceLanguage(kind: FenceKind): string | null {
  return kind === 'log' ? 'log' : null;
}

function isFenceActive(editor: Editor, kind: FenceKind): boolean {
  const isLog = editor.isActive('codeBlock', { language: 'log' });
  return kind === 'log' ? isLog : editor.isActive('codeBlock') && !isLog;
}

/**
 * Wrap the current selection as a single code/log block (one label for the
 * whole text), or unwrap if that fence is already active.
 */
export function toggleFenceBlock(editor: Editor, kind: FenceKind): boolean {
  if (editor.isDestroyed) {
    return false;
  }

  const language = fenceLanguage(kind);

  if (isFenceActive(editor, kind)) {
    return editor.chain().focus().toggleCodeBlock().run();
  }

  if (editor.isActive('codeBlock')) {
    return editor.chain().focus().updateAttributes('codeBlock', { language }).run();
  }

  if (editor.state.selection.empty) {
    return editor
      .chain()
      .focus()
      .toggleCodeBlock(language ? { language } : undefined)
      .run();
  }

  return editor
    .chain()
    .focus()
    .clearNodes()
    .command(({ state, tr, dispatch }) => {
      const type = state.schema.nodes.codeBlock;
      if (!type) {
        return false;
      }

      const doc = tr.doc;
      const { from, to } = tr.selection;
      const runs: Array<{ from: number; to: number }> = [];
      let runStart: number | null = null;
      let runEnd: number | null = null;

      doc.nodesBetween(from, to, (node, pos) => {
        if (node.type.name === 'image') {
          if (runStart !== null && runEnd !== null) {
            runs.push({ from: runStart, to: runEnd });
          }
          runStart = null;
          runEnd = null;
          return false;
        }
        if (!node.isTextblock) {
          return true;
        }
        if (runStart === null) {
          runStart = pos;
        }
        runEnd = pos + node.nodeSize;
        return false;
      });

      if (runStart !== null && runEnd !== null) {
        runs.push({ from: runStart, to: runEnd });
      }

      if (runs.length === 0) {
        return false;
      }

      if (!dispatch) {
        return true;
      }

      for (let index = runs.length - 1; index >= 0; index -= 1) {
        const run = runs[index];
        const text = doc.textBetween(run.from, run.to, '\n', '\n');
        const content = text ? state.schema.text(text) : undefined;
        const node = type.create({ language }, content);
        tr.replaceWith(run.from, run.to, node);
      }

      const caret = Math.min(tr.doc.content.size, runs[0].from + 1);
      tr.setSelection(TextSelection.create(tr.doc, caret));
      return true;
    })
    .run();
}
