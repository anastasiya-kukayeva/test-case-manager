import { Select } from '@mantine/core';
import { useMemo } from 'react';
import { useDirectoryStore } from '@/stores/useDirectoryStore';

type DirectoryApplicationSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
};

/**
 * Select an application name from the directory.
 * Keeps legacy free-text values visible if they are not in the directory.
 */
export function DirectoryApplicationSelect({
  label = 'Приложение',
  value,
  onChange,
  description = 'Выберите приложение из списка',
  required,
  error,
  placeholder = 'Выберите приложение',
}: DirectoryApplicationSelectProps) {
  const applications = useDirectoryStore((state) => state.applications);

  const data = useMemo(() => {
    const names = applications.map((item) => item.name);
    if (value.trim() && !names.includes(value)) {
      return [value, ...names];
    }
    return names;
  }, [applications, value]);

  const emptyHint = 'Список приложений пуст — добавьте в разделе «Приложения»';

  return (
    <Select
      label={label}
      description={description}
      placeholder={applications.length === 0 ? emptyHint : placeholder}
      data={data}
      value={value || null}
      onChange={(next) => onChange(next ?? '')}
      searchable
      clearable
      nothingFoundMessage="Нет совпадений"
      required={required}
      error={error}
      allowDeselect
    />
  );
}
