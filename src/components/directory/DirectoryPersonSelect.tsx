import { Select } from '@mantine/core';
import { useMemo } from 'react';
import { DIRECTORY_ROLE_LABELS, type DirectoryRole } from '@/domain/types';
import { useDirectoryStore } from '@/stores/useDirectoryStore';

type DirectoryPersonSelectProps = {
  role: DirectoryRole;
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
};

/**
 * Select a person name from the role-specific directory list.
 * Keeps legacy free-text values visible if they are not in the directory.
 */
export function DirectoryPersonSelect({
  role,
  label,
  value,
  onChange,
  description,
  required,
  error,
  placeholder = 'Выберите из справочника',
}: DirectoryPersonSelectProps) {
  const people = useDirectoryStore((state) => state.people);

  const rolePeople = useMemo(
    () => people.filter((person) => person.role === role),
    [people, role],
  );

  const data = useMemo(() => {
    const names = rolePeople.map((person) => person.name);
    if (value.trim() && !names.includes(value)) {
      return [value, ...names];
    }
    return names;
  }, [rolePeople, value]);

  const emptyHint = `Справочник «${DIRECTORY_ROLE_LABELS[role]}» пуст — заполните в меню «Справочник»`;

  return (
    <Select
      label={label}
      description={description}
      placeholder={rolePeople.length === 0 ? emptyHint : placeholder}
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
