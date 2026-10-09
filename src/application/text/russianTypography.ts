import type { Editor } from '@tiptap/core';
import Typograf from 'typograf';

const typograf = new Typograf({ locale: ['ru', 'en-US'] });

// Test steps often use "x" and "!=" as written, not as math signs.
typograf.disableRule('common/number/times');
typograf.disableRule('common/number/mathSigns');

/** Russian typography: «quotes», em dash, ellipsis, non-breaking spaces. */
export function applyRussianTypography(text: string): string {
  if (!text.trim()) {
    return text;
  }
  return typograf.execute(text);
}

/** Apply Russian typography to every text node except code and log blocks. */
export function applyTypographyInEditor(editor: Editor): boolean {
  if (editor.isDestroyed) {
    return false;
  }

  return editor
    .chain()
    .command(({ tr, state }) => {
      const replacements: { from: number; to: number; text: string }[] = [];

      state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) {
          return;
        }
        const resolved = state.doc.resolve(pos);
        for (let depth = resolved.depth; depth > 0; depth -= 1) {
          if (resolved.node(depth).type.name === 'codeBlock') {
            return;
          }
        }
        const next = applyRussianTypography(node.text);
        if (!next || next === node.text) {
          return;
        }
        replacements.push({ from: pos, to: pos + node.text.length, text: next });
      });

      if (replacements.length === 0) {
        return false;
      }

      for (let index = replacements.length - 1; index >= 0; index -= 1) {
        const item = replacements[index];
        const marks = state.doc.resolve(item.from).marks();
        tr.replaceWith(item.from, item.to, state.schema.text(item.text, marks));
      }
      return true;
    })
    .run();
}
