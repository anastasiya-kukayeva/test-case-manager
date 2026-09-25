import {
  ActionIcon,
  Badge,
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
import { IconPencil, IconPlus, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
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
  const setDefaultAuthor = useDirectoryStore((state) => state.setDefaultAuthor);

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
                  <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" truncate>
                      {person.name}
                    </Text>
                    {role === 'author' && person.isDefault ? (
                      <Badge size="xs" variant="light">
                        По умолчанию
                      </Badge>
                    ) : null}
                  </Group>
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
                      {role === 'author' ? (
                        <Tooltip
                          label={
                            person.isDefault
                              ? 'Снять значение по умолчанию'
                              : 'Сделать значением по умолчанию'
                          }
                        >
                          <ActionIcon
                            variant="subtle"
                            color={person.isDefault ? 'yellow' : 'gray'}
                            aria-label={
                              person.isDefault
                                ? 'Снять значение по умолчанию'
                                : 'Сделать значением по умолчанию'
                            }
                            onClick={() => void setDefaultAuthor(person.id)}
                          >
                            {person.isDefault ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
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

type NamedListSectionProps = {
  title: string;
  placeholder: string;
  items: Array<{ id: string; name: string; isDefault?: boolean }>;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onAdd: (name: string) => Promise<unknown>;
  onUpdate: (id: string, name: string) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onSetDefault?: (id: string) => Promise<boolean>;
};

function NamedListSection({
  title,
  placeholder,
  items,
  busy,
  setBusy,
  onAdd,
  onUpdate,
  onRemove,
  onSetDefault,
}: NamedListSectionProps) {
  const [draftName, setDraftName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    setBusy(true);
    const created = await onAdd(draftName);
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
    const ok = await onUpdate(editingId, editingName);
    setBusy(false);
    if (ok) {
      setEditingId(null);
      setEditingName('');
    }
  };

  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Stack gap="md">
        <div>
          <Text fw={700}>{title}</Text>
          <Text size="sm" c="dimmed">
            Записей: {items.length}
          </Text>
        </div>

        <Group align="flex-end" wrap="nowrap" gap="xs">
          <TextInput
            label="Название"
            placeholder={placeholder}
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
          {items.length === 0 ? (
            <Text c="dimmed" size="sm">
              Список пуст. Добавьте первую запись.
            </Text>
          ) : (
            items.map((item) => (
              <Group key={item.id} justify="space-between" wrap="nowrap" gap="sm">
                {editingId === item.id ? (
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
                  <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" truncate>
                      {item.name}
                    </Text>
                    {onSetDefault && item.isDefault ? (
                      <Badge size="xs" variant="light">
                        По умолчанию
                      </Badge>
                    ) : null}
                  </Group>
                )}

                <Group gap={4} wrap="nowrap">
                  {editingId === item.id ? (
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
                      {onSetDefault ? (
                        <Tooltip
                          label={
                            item.isDefault
                              ? 'Снять значение по умолчанию'
                              : 'Сделать значением по умолчанию'
                          }
                        >
                          <ActionIcon
                            variant="subtle"
                            color={item.isDefault ? 'yellow' : 'gray'}
                            aria-label={
                              item.isDefault
                                ? 'Снять значение по умолчанию'
                                : 'Сделать значением по умолчанию'
                            }
                            onClick={() => void onSetDefault(item.id)}
                          >
                            {item.isDefault ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      ) : null}
                      <Tooltip label="Изменить">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditingName(item.name);
                          }}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Удалить">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => void onRemove(item.id)}
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
  const applications = useDirectoryStore((state) => state.applications);
  const modules = useDirectoryStore((state) => state.modules);
  const environments = useDirectoryStore((state) => state.environments);
  const addApplication = useDirectoryStore((state) => state.addApplication);
  const updateApplication = useDirectoryStore((state) => state.updateApplication);
  const removeApplication = useDirectoryStore((state) => state.removeApplication);
  const addModule = useDirectoryStore((state) => state.addModule);
  const updateModule = useDirectoryStore((state) => state.updateModule);
  const removeModule = useDirectoryStore((state) => state.removeModule);
  const addEnvironment = useDirectoryStore((state) => state.addEnvironment);
  const setDefaultEnvironment = useDirectoryStore((state) => state.setDefaultEnvironment);
  const updateEnvironment = useDirectoryStore((state) => state.updateEnvironment);
  const removeEnvironment = useDirectoryStore((state) => state.removeEnvironment);
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
            Списки для подстановки в задачах и тест-кейсах.
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

      <FadeIn delay={0.08}>
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <NamedListSection
            title="Модуль"
            placeholder="Например: Авторизация"
            items={modules}
            busy={busy}
            setBusy={setBusy}
            onAdd={addModule}
            onUpdate={updateModule}
            onRemove={removeModule}
          />
          <NamedListSection
            title="Приложение"
            placeholder="Например: CRM Portal"
            items={applications}
            busy={busy}
            setBusy={setBusy}
            onAdd={addApplication}
            onUpdate={updateApplication}
            onRemove={removeApplication}
          />
          <NamedListSection
            title="Среды"
            placeholder="Например: Тестовая"
            items={environments}
            busy={busy}
            setBusy={setBusy}
            onAdd={addEnvironment}
            onUpdate={updateEnvironment}
            onRemove={removeEnvironment}
            onSetDefault={setDefaultEnvironment}
          />
        </SimpleGrid>
      </FadeIn>
    </Stack>
  );
}
