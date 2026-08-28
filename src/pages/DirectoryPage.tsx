import {
  ActionIcon,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { FadeIn } from '@/components/ui/FadeIn';
import {
  DIRECTORY_ROLE_LABELS,
  DIRECTORY_ROLES,
  type DirectoryPerson,
  type DirectoryRole,
} from '@/domain/types';
import { useDirectoryStore } from '@/stores/useDirectoryStore';

type RoleSectionProps = {
  role: DirectoryRole;
  people: DirectoryPerson[];
  busy: boolean;
  setBusy: (value: boolean) => void;
};

function RoleSection({ role, people, busy, setBusy }: RoleSectionProps) {
  const addPerson = useDirectoryStore((state) => state.addPerson);
  const updatePerson = useDirectoryStore((state) => state.updatePerson);
  const removePerson = useDirectoryStore((state) => state.removePerson);

  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const label = DIRECTORY_ROLE_LABELS[role];

  const handleAdd = async () => {
    setBusy(true);
    const created = await addPerson(role, draftName);
    setBusy(false);
    if (created) {
      setDraftName('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      return;
    }
    setBusy(true);
    const ok = await updatePerson(editingId, editingName);
    setBusy(false);
    if (ok) {
      setEditingId(null);
      setEditingName('');
    }
  };

  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={700}>{label}</Text>
            <Text size="sm" c="dimmed">
              Записей: {people.length}
            </Text>
          </div>
        </Group>

        <Group align="flex-end" wrap="nowrap" gap="xs">
          <TextInput
            label="ФИО / наименование"
            placeholder="Например: Иванова А.С."
            value={draftName}
            onChange={(event) => {
              const value = event.currentTarget?.value ?? event.target?.value ?? '';
              setDraftName(value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleAdd();
              }
            }}
            style={{ flex: 1 }}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            loading={busy}
            onClick={() => void handleAdd()}
            disabled={!draftName.trim()}
          >
            Добавить
          </Button>
        </Group>

        <Stack gap="xs">
          {people.length === 0 ? (
            <Text c="dimmed" size="sm">
              Список пуст. Добавьте первую запись.
            </Text>
          ) : (
            people.map((person) => (
              <Group key={person.id} justify="space-between" wrap="nowrap" gap="sm">
                {editingId === person.id ? (
                  <TextInput
                    value={editingName}
                    onChange={(event) => {
                      const value = event.currentTarget?.value ?? event.target?.value ?? '';
                      setEditingName(value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSaveEdit();
                      }
                      if (event.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Text style={{ flex: 1 }} size="sm">
                    {person.name}
                  </Text>
                )}

                <Group gap={4} wrap="nowrap">
                  {editingId === person.id ? (
                    <>
                      <Button size="xs" loading={busy} onClick={() => void handleSaveEdit()}>
                        Сохранить
                      </Button>
                      <Button
                        size="xs"
                        variant="default"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                      >
                        Отмена
                      </Button>
                    </>
                  ) : (
                    <>
                      <Tooltip label="Изменить">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEditingId(person.id);
                            setEditingName(person.name);
                          }}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Удалить">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => void removePerson(person.id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                </Group>
              </Group>
            ))
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

export function DirectoryPage() {
  const people = useDirectoryStore((state) => state.people);
  const isLoaded = useDirectoryStore((state) => state.isLoaded);
  const load = useDirectoryStore((state) => state.load);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      void load();
    }
  }, [isLoaded, load]);

  const byRole = useMemo(() => {
    const map: Record<DirectoryRole, DirectoryPerson[]> = {
      author: [],
      developer: [],
      businessAnalyst: [],
    };
    for (const person of people) {
      map[person.role].push(person);
    }
    for (const role of DIRECTORY_ROLES) {
      map[role] = [...map[role]].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
    return map;
  }, [people]);

  return (
    <Stack gap="lg">
      <FadeIn>
        <div>
          <Title order={2}>Справочник</Title>
          <Text c="dimmed" mt="xs">
            Люди по ролям для подстановки в задачах и тест-кейсах.
          </Text>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          {DIRECTORY_ROLES.map((role) => (
            <RoleSection
              key={role}
              role={role}
              people={byRole[role]}
              busy={busy}
              setBusy={setBusy}
            />
          ))}
        </SimpleGrid>
      </FadeIn>
    </Stack>
  );
}
