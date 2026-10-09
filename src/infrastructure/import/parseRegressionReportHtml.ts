export type ParsedRegressionReportCase = {
  /** From the bold prefix «Приложение. Модуль.» Empty when the cell has no such prefix. */
  applicationName: string;
  moduleName: string;
  goalHtml: string;
  goalText: string;
  outcome: 'passed' | 'failed' | null;
};

const DESCRIPTION_HEADER = 'модуль / подраздел';

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLabel(value: string): string {
  return value.replace(/ё/gi, 'е').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru');
}

function plainCell(html: string): string {
  return stripTags(html).replace(/\s+/g, ' ').trim();
}

/** «Приложение. Модуль.» or a single «Название.» from the leading bold run. */
function parsePrefix(strongText: string): { applicationName: string; moduleName: string } | null {
  const text = strongText.replace(/\s+/g, ' ').trim();
  const two = text.match(/^(.+?)\.\s+(.+?)\.\s*$/);
  if (two?.[1] && two[2]) {
    return { applicationName: two[1].trim(), moduleName: two[2].trim() };
  }
  const one = text.match(/^(.+?)\.\s*$/);
  if (one?.[1]?.trim()) {
    return { applicationName: '', moduleName: one[1].trim() };
  }
  return null;
}

/** Keep the visible label of a hyperlink. The address is not imported. */
function linksToVisibleText(html: string): string {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (_, inner: string) =>
    stripTags(inner).replace(/\s+/g, ' ').trim(),
  );
}

function sanitizeGoalHtml(fragment: string): string {
  let html = linksToVisibleText(fragment);
  html = html.replace(/<\/?(?!p\b|br\b|strong\b|b\b|em\b|i\b|u\b)[a-z0-9]+[^>]*>/gi, '');
  html = html.replace(/<(strong|b|em|i|u)>\s*<\/\1>/gi, '');
  html = html.trim();
  if (!html) {
    return '';
  }
  if (!/^<p[\s>]/i.test(html)) {
    html = `<p>${html}`;
  }
  html = html.replace(/^(<p[^>]*>)\s+/, '$1').replace(/\s+(<\/p>)\s*$/i, '$1');
  return html;
}

function buildGoal(fragment: string): { goalHtml: string; goalText: string } {
  const goalHtml = sanitizeGoalHtml(fragment);
  const goalText = stripTags(goalHtml).replace(/\s+/g, ' ').trim();
  if (!goalText) {
    return { goalHtml: '', goalText: '' };
  }
  return { goalHtml, goalText };
}

function splitDescription(cellHtml: string): {
  applicationName: string;
  moduleName: string;
  goalHtml: string;
  goalText: string;
} {
  const cell = cellHtml.trim();
  const match = cell.match(/^(?:\s*<p[^>]*>\s*)?<(strong|b)>([\s\S]*?)<\/\1>/i);
  if (match) {
    const prefix = parsePrefix(stripTags(match[2] ?? ''));
    if (prefix) {
      const rest = cell.slice((match.index ?? 0) + match[0].length);
      const goal = buildGoal(rest);
      if (goal.goalText) {
        return { ...prefix, ...goal };
      }
    }
  }
  return { applicationName: '', moduleName: '', ...buildGoal(cell) };
}

function parseOutcome(text: string): 'passed' | 'failed' | null {
  const value = normalizeLabel(text);
  if (value === 'pass' || value === 'passed' || value === 'пройден') {
    return 'passed';
  }
  if (value === 'fail' || value === 'failed' || value === 'не пройден') {
    return 'failed';
  }
  return null;
}

function tableRows(tableHtml: string): string[][] {
  const rows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return rows.map((row) => {
    const cells = row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
    return cells.map((cell) => cell.replace(/^<t[dh][^>]*>/i, '').replace(/<\/t[dh]>$/i, ''));
  });
}

function findReportTable(html: string): string[][] | null {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const table of tables) {
    const rows = tableRows(table);
    const header = rows[0];
    if (!header) {
      continue;
    }
    const hasDescription = header.some((cell) => normalizeLabel(plainCell(cell)) === DESCRIPTION_HEADER);
    if (hasDescription) {
      return rows;
    }
  }
  return null;
}

/** Cases from the report table «Основные модули и статус проверки». */
export function parseRegressionReportHtml(html: string): ParsedRegressionReportCase[] {
  const rows = findReportTable(html);
  if (!rows || rows.length === 0) {
    return [];
  }

  const header = rows[0] ?? [];
  const descriptionIndex = header.findIndex(
    (cell) => normalizeLabel(plainCell(cell)) === DESCRIPTION_HEADER,
  );
  const statusIndex = header.findIndex((cell) => normalizeLabel(plainCell(cell)) === 'статус');
  const cases: ParsedRegressionReportCase[] = [];

  for (const row of rows.slice(1)) {
    const description = row[descriptionIndex] ?? '';
    if (normalizeLabel(plainCell(description)) === DESCRIPTION_HEADER) {
      continue;
    }
    const split = splitDescription(description);
    if (!split.goalText) {
      continue;
    }
    const statusText = statusIndex >= 0 ? plainCell(row[statusIndex] ?? '') : '';
    cases.push({
      applicationName: split.applicationName,
      moduleName: split.moduleName,
      goalHtml: split.goalHtml,
      goalText: split.goalText,
      outcome: parseOutcome(statusText),
    });
  }

  return cases;
}
