function anchorPattern(): RegExp {
  return /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
}

function urlPattern(): RegExp {
  return /(?:https?:\/\/|www\.|mailto:)\S+/gi;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(
    /\u00a0/g,
    ' ',
  );
}

function attribute(attrs: string, name: string): string {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? '').trim();
}

function isUrlText(value: string): boolean {
  return /^(?:https?:\/\/|www\.|mailto:)\S+$/i.test(value.trim());
}

function containsUrl(value: string): boolean {
  return /(?:https?:\/\/|www\.|mailto:)\S+/i.test(value);
}

/** http(s) or mailto. File paths stay plain text so Word does not link another file. */
export function webHref(value: string): string {
  const trimmed = value.trim().replace(/[),.;:!?]+$/g, '');
  if (!trimmed) {
    return '';
  }
  const withProtocol = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  return /^(https?:|mailto:)/i.test(withProtocol) ? withProtocol : '';
}

function firstWebUrl(value: string): string {
  const match = value.match(/(?:https?:\/\/|www\.|mailto:)\S+/i);
  return match ? webHref(match[0]) : '';
}

/** Remove URL tokens and the empty brackets or dashes left around them. */
export function textWithoutLinkAddresses(value: string): string {
  return value
    .replace(urlPattern(), (match) => {
      const core = match.replace(/[),.;:!?]+$/g, '');
      return match.slice(core.length);
    })
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/(?:^|\s)[—–-]\s*(?=[,.;:]|$)/g, ' ')
    .replace(/^[\s,;:.—–-]+|[\s,;:.—–-]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Visible name of a hyperlink. When the address is written inside the link,
 * the name stays and the address is kept only as the target.
 */
export function visibleAnchor(input: { href?: string; text: string; title?: string }): {
  text: string;
  href: string;
} {
  const text = input.text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const title = (input.title ?? '').replace(/\s+/g, ' ').trim();
  const embedded = containsUrl(text);
  const name = embedded ? textWithoutLinkAddresses(text) : text;
  const titled = title && !isUrlText(title) ? title : '';
  const label = name || titled || text;
  const href = webHref(input.href ?? '') || (name ? firstWebUrl(text) : '');
  return { text: label, href };
}

function renderAnchor(href: string, innerHtml: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${innerHtml}</a>`;
}

/** Keep the link target. If the address is the link text, show the name instead. */
export function normalizeEmbeddedLinkHtml(html: string): string {
  if (!html || !/<a\b/i.test(html)) {
    return html;
  }
  return html.replace(anchorPattern(), (full, attrs: string, inner: string) => {
    const original = stripTags(inner).replace(/\s+/g, ' ').trim();
    const visible = visibleAnchor({
      href: attribute(attrs, 'href'),
      title: attribute(attrs, 'title'),
      text: original,
    });
    if (!visible.href) {
      return containsUrl(original) ? escapeHtml(visible.text) : full;
    }
    if (original === visible.text) {
      return renderAnchor(visible.href, inner);
    }
    return renderAnchor(visible.href, escapeHtml(visible.text));
  });
}

export function visibleTextFromHtml(html: string): string {
  if (!html.trim()) {
    return '';
  }
  return stripTags(normalizeEmbeddedLinkHtml(html)).replace(/\s+/g, ' ').trim();
}

/** One line for a list: link names stay clickable, the address is not written out. */
export function fieldDescriptionHtml(
  content: { html?: string; plainText?: string } | undefined,
): string {
  const html = content?.html?.trim() ?? '';
  if (html && /<a\b/i.test(html)) {
    const normalized = normalizeEmbeddedLinkHtml(html);
    const anchors: string[] = [];
    const withTokens = normalized.replace(anchorPattern(), (anchor) => {
      anchors.push(anchor);
      return `\u0000${anchors.length - 1}\u0000`;
    });
    const text = stripTags(withTokens.replace(/<\/p>/gi, ' ')).replace(/\s+/g, ' ').trim();
    const inline = escapeHtml(text).replace(/\u0000(\d+)\u0000/g, (_token, index: string) => {
      const anchor = anchors[Number(index)] ?? '';
      const href = webHref(attribute(anchor, 'href'));
      const inner = stripTags(anchor.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, ''))
        .replace(/\s+/g, ' ')
        .trim();
      if (!href || !inner) {
        return escapeHtml(inner);
      }
      return renderAnchor(href, escapeHtml(inner));
    });
    if (inline.trim()) {
      return inline;
    }
  }
  const plain = (content?.plainText ?? '').trim();
  return escapeHtml(textWithoutLinkAddresses(plain) || plain);
}
