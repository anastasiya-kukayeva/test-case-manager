import type { TestCase } from '@/domain/types';

/** Assign sequential numbers "1".."n" by array order. */
export function renumberTestCases(testCases: TestCase[]): TestCase[] {
  return testCases.map((testCase, index) => {
    const nextNumber = String(index + 1);
    if (testCase.number === nextNumber) {
      return testCase;
    }
    return { ...testCase, number: nextNumber };
  });
}

/**
 * Reorder items in `all` so that the subset matching `orderedIds`
 * follows that order, keeping relative slots of the subset.
 * If `orderedIds` covers the full list, replace order entirely.
 */
export function reorderTestCasesByIds(
  all: TestCase[],
  orderedIds: string[],
): TestCase[] {
  if (orderedIds.length === 0) {
    return all;
  }

  const byId = new Map(all.map((item) => [item.id, item]));
  if (orderedIds.some((id) => !byId.has(id))) {
    return all;
  }

  if (orderedIds.length === all.length) {
    return orderedIds.map((id) => byId.get(id)!);
  }

  const idSet = new Set(orderedIds);
  const slots = all
    .map((item, index) => (idSet.has(item.id) ? index : -1))
    .filter((index) => index >= 0);

  if (slots.length !== orderedIds.length) {
    return all;
  }

  const next = [...all];
  orderedIds.forEach((id, offset) => {
    next[slots[offset]] = byId.get(id)!;
  });
  return next;
}

export function nextTestCaseNumber(testCases: TestCase[]): string {
  let max = testCases.length;
  for (const testCase of testCases) {
    const parsed = Number.parseInt(String(testCase.number).trim(), 10);
    if (Number.isFinite(parsed) && parsed > max) {
      max = parsed;
    }
  }
  return String(max + 1);
}
