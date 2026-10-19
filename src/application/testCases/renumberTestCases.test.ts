import { describe, expect, it } from 'vitest';
import { createEmptyTestCase } from '@/domain/factories/createEntities';
import {
  nextTestCaseNumber,
  renumberTestCases,
  reorderTestCasesByIds,
} from '@/application/testCases/renumberTestCases';

function testCase(id: string, number: string, regressionOnly = false) {
  return createEmptyTestCase({ id, number, regressionOnly });
}

describe('renumberTestCases', () => {
  it('assigns 1..n in array order and keeps the object when the number is already right', () => {
    const first = testCase('a', '1');
    const second = testCase('b', '9');
    const result = renumberTestCases([first, second]);

    expect(result[0]).toBe(first);
    expect(result[1]).not.toBe(second);
    expect(result.map((item) => item.number)).toEqual(['1', '2']);
  });
});

describe('reorderTestCasesByIds', () => {
  const cases = [testCase('a', '1'), testCase('b', '2'), testCase('c', '3'), testCase('d', '4')];

  it('reorders a subset inside its current slots', () => {
    expect(reorderTestCasesByIds(cases, ['c', 'a']).map((item) => item.id)).toEqual([
      'c',
      'b',
      'a',
      'd',
    ]);
  });

  it('replaces the order when every case is listed', () => {
    expect(reorderTestCasesByIds(cases, ['d', 'c', 'b', 'a']).map((item) => item.id)).toEqual([
      'd',
      'c',
      'b',
      'a',
    ]);
  });

  it('leaves the list untouched for an empty, unknown or duplicated id list', () => {
    expect(reorderTestCasesByIds(cases, [])).toBe(cases);
    expect(reorderTestCasesByIds(cases, ['a', 'missing'])).toBe(cases);
    expect(reorderTestCasesByIds(cases, ['a', 'a'])).toBe(cases);
  });
});

describe('nextTestCaseNumber', () => {
  it('ignores regression-only cases and continues after the highest task number', () => {
    const cases = [testCase('a', '1'), testCase('b', '5'), testCase('r', '99', true)];

    expect(nextTestCaseNumber(cases)).toBe('6');
  });

  it('starts at 1 when the task has no regular cases', () => {
    expect(nextTestCaseNumber([testCase('r', '4', true)])).toBe('1');
  });
});
