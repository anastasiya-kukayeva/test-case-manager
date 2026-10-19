import type { RichTextContent } from '@/domain/types';
import { textWithoutLinkAddresses, visibleTextFromHtml } from '@/domain/utils/embeddedLinks';

/**
 * Label of a regression case: the goal text with hyperlink addresses removed.
 * A link keeps its visible name. A bare address falls back to the case title.
 */
export function regressionCaseLabel(
  goal: Pick<RichTextContent, 'html' | 'plainText'> | undefined,
  title?: string,
): string {
  const fromHtml = textWithoutLinkAddresses(visibleTextFromHtml(goal?.html ?? ''));
  const fromPlain = textWithoutLinkAddresses(goal?.plainText ?? '');
  const fromTitle = textWithoutLinkAddresses(title ?? '');
  return (
    fromHtml || fromPlain || fromTitle || (goal?.plainText ?? '').trim() || (title ?? '').trim()
  );
}
