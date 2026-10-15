import type { RichTextContent } from '@/domain/types';
import { createEmptyRichText } from '@/domain/factories/createEntities';

/** Text, an image, a code block, or a log counts as filled. */
export function isRichContentFilled(value: RichTextContent | undefined): boolean {
  if (!value) {
    return false;
  }
  if (value.plainText.trim().length > 0) {
    return true;
  }
  const html = value.html ?? '';
  return /<img\b/i.test(html) || /<pre\b/i.test(html);
}

export function emptyRichContent(): RichTextContent {
  return createEmptyRichText();
}
