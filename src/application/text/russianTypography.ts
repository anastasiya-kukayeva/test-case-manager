import type { Editor } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import Typograf from 'typograf';

const typograf = new Typograf({ locale: ['ru', 'en-US'] });

// Test steps often use "x" and "!=" as written, not as math signs.
typograf.disableRule('common/number/times');
typograf.disableRule('common/number/mathSigns');

// Text is processed per field and per formatted run. These rules delete spaces
// the user typed, including the space between differently formatted fragments,
// as soon as focus leaves the field.
typograf.disableRule('common/space/trimLeft');
typograf.disableRule('common/space/trimRight');
typograf.disableRule('common/space/delLeadingBlanks');
typograf.disableRule('common/space/delTrailingBlanks');
typograf.disableRule('common/space/delRepeatSpace');
typograf.disableRule('common/space/delBeforePunctuation');
typograf.disableRule('common/space/delBeforeDot');
typograf.disableRule('common/space/delBeforePercent');
typograf.disableRule('common/space/delBetweenExclamationMarks');

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
      const replacements: { from: number; to: number; text: string; marks: readonly Mark[] }[] = [];

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
        replacements.push({
          from: pos,
          to: pos + node.text.length,
          text: next,
          marks: node.marks,
        });
      });

      if (replacements.length === 0) {
        return false;
      }

      for (let index = replacements.length - 1; index >= 0; index -= 1) {
        const item = replacements[index];
        tr.replaceWith(item.from, item.to, state.schema.text(item.text, item.marks));
      }
      return true;
    })
    .run();
}
