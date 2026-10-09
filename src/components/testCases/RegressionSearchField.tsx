import { ActionIcon, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useUiStore } from '@/stores/useUiStore';

/** Partial-match search for the regression lists. */
export function RegressionSearchField() {
  const query = useUiStore((state) => state.regressionSearch);
  const setRegressionSearch = useUiStore((state) => state.setRegressionSearch);

  return (
    <TextInput
      placeholder="Поиск по цели, номеру, модулю или задаче"
      leftSection={<IconSearch size={16} />}
      value={query}
      onChange={(event) => {
        setRegressionSearch(event.currentTarget?.value ?? event.target?.value ?? '');
      }}
      rightSection={
        query.trim() ? (
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Очистить поиск"
            onClick={() => setRegressionSearch('')}
          >
            <IconX size={14} />
          </ActionIcon>
        ) : null
      }
    />
  );
}
