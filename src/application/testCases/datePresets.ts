import dayjs, { type Dayjs } from 'dayjs';

export type DateFilterField = 'createdAt' | 'updatedAt';

export type DateQuickPreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'allTime';

export type DateFilterState = {
  field: DateFilterField;
  preset: DateQuickPreset;
  exactDate: string | null;
  range: [string | null, string | null];
};

export const DEFAULT_DATE_FILTER: DateFilterState = {
  field: 'createdAt',
  preset: 'allTime',
  exactDate: null,
  range: [null, null],
};

export const DATE_PRESET_OPTIONS: Array<{ value: DateQuickPreset; label: string }> = [
  { value: 'today', label: 'Сегодня' },
  { value: 'yesterday', label: 'Вчера' },
  { value: 'last7', label: 'Последние 7 дней' },
  { value: 'last30', label: 'Последние 30 дней' },
  { value: 'thisMonth', label: 'Этот месяц' },
  { value: 'lastMonth', label: 'Прошлый месяц' },
  { value: 'allTime', label: 'За всё время' },
];

export function getPresetRange(preset: DateQuickPreset, now = dayjs()): [Dayjs, Dayjs] | null {
  switch (preset) {
    case 'today':
      return [now.startOf('day'), now.endOf('day')];
    case 'yesterday': {
      const day = now.subtract(1, 'day');
      return [day.startOf('day'), day.endOf('day')];
    }
    case 'last7':
      return [now.subtract(6, 'day').startOf('day'), now.endOf('day')];
    case 'last30':
      return [now.subtract(29, 'day').startOf('day'), now.endOf('day')];
    case 'thisMonth':
      return [now.startOf('month'), now.endOf('month')];
    case 'lastMonth': {
      const prev = now.subtract(1, 'month');
      return [prev.startOf('month'), prev.endOf('month')];
    }
    case 'allTime':
      return null;
    default:
      return null;
  }
}

export function matchesDateFilter(isoDate: string, filter: DateFilterState): boolean {
  const value = dayjs(isoDate);
  if (!value.isValid()) {
    return false;
  }

  if (filter.exactDate) {
    return value.isSame(dayjs(filter.exactDate), 'day');
  }

  const [from, to] = filter.range;
  if (from || to) {
    if (from && value.isBefore(dayjs(from).startOf('day'))) {
      return false;
    }
    if (to && value.isAfter(dayjs(to).endOf('day'))) {
      return false;
    }
    return true;
  }

  const presetRange = getPresetRange(filter.preset);
  if (!presetRange) {
    return true;
  }

  const [start, end] = presetRange;
  return (value.isAfter(start) || value.isSame(start)) && (value.isBefore(end) || value.isSame(end));
}
