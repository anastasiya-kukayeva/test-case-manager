import { Select } from '@mantine/core';
import { useMemo } from 'react';
import { useDirectoryStore } from '@/stores/useDirectoryStore';

type DirectoryModuleSelectProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
};

/** Select a module name from the directory. Keeps a saved value visible if it left the list. */
export function DirectoryModuleSelect({
  label = 'Модуль',
  value,
  onChange,
  description = 'Выберите модуль из справочника',
  required,
  error,
  placeholder = 'Выберите модуль',
}: DirectoryModuleSelectProps) {
  const modules = useDirectoryStore((state) => state.modules);

  const data = useMemo(() => {
    const names = modules.map((item) => item.name);
    if (value.trim() && !names.includes(value)) {
      return [value, ...names];
    }
    return names;
  }, [modules, value]);

  const emptyHint = 'Список модулей пуст — заполните в меню «Справочник»';

  return (
    <Select
      label={label}
      description={description}
      placeholder={modules.length === 0 ? emptyHint : placeholder}
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
