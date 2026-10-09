const WORD_HIGHLIGHTS: Record<string, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgreen: '#006400',
  darkmagenta: '#8b008b',
  darkred: '#8b0000',
  darkyellow: '#b8860b',
  darkgray: '#a9a9a9',
  lightgray: '#d3d3d3',
  black: '#000000',
  white: '#ffffff',
};

function readMsoHighlight(style: string): string | null {
  const match = style.match(/mso-highlight\s*:\s*([a-z]+)/i);
  if (!match?.[1]) {
    return null;
  }
  return WORD_HIGHLIGHTS[match[1].toLowerCase()] ?? null;
}

function readShorthandBackground(style: string): string | null {
  const match = style.match(/(?:^|;)\s*background\s*:\s*([^;]+)/i);
  const value = match?.[1]?.trim();
  if (!value || value.includes('url(')) {
    return null;
  }
  return value;
}

/**
 * Turn Word / browser clipboard HTML into tags the editor already understands:
 * bold, italic, underline, text color and highlight.
 */
export function normalizePastedHtml(html: string): string {
  if (!html.trim() || typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const font of [...doc.querySelectorAll('font')]) {
    const span = doc.createElement('span');
    const color = font.getAttribute('color');
    if (color) {
      span.style.color = color;
    }
    const style = font.getAttribute('style');
    if (style) {
      span.setAttribute('style', `${span.getAttribute('style') ?? ''};${style}`);
    }
    span.innerHTML = font.innerHTML;
    font.replaceWith(span);
  }

  for (const element of doc.body.querySelectorAll<HTMLElement>('[style]')) {
    const style = element.getAttribute('style') ?? '';
    const highlight = readMsoHighlight(style);
    if (highlight) {
      element.style.backgroundColor = highlight;
    } else if (!element.style.backgroundColor) {
      const background = readShorthandBackground(style);
      if (background) {
        element.style.backgroundColor = background;
      }
    }
  }

  return doc.body.innerHTML;
}
