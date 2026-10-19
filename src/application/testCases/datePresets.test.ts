import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  getPresetRange,
  matchesDateFilter,
  type DateFilterState,
} from '@/application/testCases/datePresets';

function filter(partial: Partial<DateFilterState>): DateFilterState {
  return {
    field: 'createdAt',
    preset: 'allTime',
    exactDate: null,
    range: [null, null],
    ...partial,
  };
}

describe('getPresetRange', () => {
  const now = dayjs('2026-03-15T15:30:00');

  it('builds inclusive calendar ranges from a fixed day', () => {
    expect(getPresetRange('allTime', now)).toBeNull();
    expect(getPresetRange('today', now)?.map((value) => value.format('YYYY-MM-DD'))).toEqual([
      '2026-03-15',
      '2026-03-15',
    ]);
    expect(getPresetRange('yesterday', now)?.[0].format('YYYY-MM-DD')).toBe('2026-03-14');
    expect(getPresetRange('last7', now)?.[0].format('YYYY-MM-DD')).toBe('2026-03-09');
    expect(getPresetRange('thisMonth', now)?.map((value) => value.format('YYYY-MM-DD'))).toEqual([
      '2026-03-01',
      '2026-03-31',
    ]);
    expect(getPresetRange('lastMonth', now)?.map((value) => value.format('YYYY-MM-DD'))).toEqual([
      '2026-02-01',
      '2026-02-28',
    ]);
  });
});

describe('matchesDateFilter', () => {
  it('rejects an invalid date and accepts any valid date for all time', () => {
    expect(matchesDateFilter('не дата', filter({}))).toBe(false);
    expect(matchesDateFilter('2020-01-01', filter({}))).toBe(true);
  });

  it('matches an exact day before a custom range', () => {
    expect(matchesDateFilter('2026-03-15', filter({ exactDate: '2026-03-15' }))).toBe(true);
    expect(
      matchesDateFilter(
        '2026-04-01',
        filter({ exactDate: '2026-03-15', range: ['2026-04-01', '2026-04-02'] }),
      ),
    ).toBe(false);
  });

  it('includes both ends of a custom range', () => {
    const range = filter({ range: ['2026-03-01', '2026-03-31'] });

    expect(matchesDateFilter('2026-03-01', range)).toBe(true);
    expect(matchesDateFilter('2026-03-31', range)).toBe(true);
    expect(matchesDateFilter('2026-02-28', range)).toBe(false);
    expect(matchesDateFilter('2026-04-01', range)).toBe(false);
  });

  it('uses the active preset when no exact date or range is set', () => {
    expect(matchesDateFilter(dayjs().toISOString(), filter({ preset: 'today' }))).toBe(true);
    expect(
      matchesDateFilter(dayjs().subtract(2, 'day').toISOString(), filter({ preset: 'yesterday' })),
    ).toBe(false);
  });
});
