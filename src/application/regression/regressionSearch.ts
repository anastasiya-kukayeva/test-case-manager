import type { RegressionCaseItem } from '@/application/regression/loadRegressionGroups';

/** True when every case matches, or any fragment contains the query. */
export function matchesPartialQuery(query: string, parts: Array<string | undefined | null>): boolean {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (!needle) {
    return true;
  }
  return parts.some((part) => (part ?? '').toLocaleLowerCase('ru').includes(needle));
}

export function regressionCaseMatches(item: RegressionCaseItem, query: string): boolean {
  return matchesPartialQuery(query, [
    item.number,
    item.title,
    item.goal?.plainText,
    item.taskShortLabel,
    item.taskName,
    item.application,
    item.module,
  ]);
}
