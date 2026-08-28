import { ActionIcon, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconLink, IconPlus, IconTrash } from '@tabler/icons-react';
import { nanoid } from 'nanoid';
import type { NamedLink } from '@/domain/types';

type TestObjectLinksFieldProps = {
  value: NamedLink[];
  onChange: (value: NamedLink[]) => void;
};

function normalizeUrlInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function TestObjectLinksField({ value, onChange }: TestObjectLinksFieldProps) {
  const links = value ?? [];

  const updateLink = (id: string, partial: Partial<NamedLink>) => {
    onChange(links.map((link) => (link.id === id ? { ...link, ...partial } : link)));
  };

  const removeLink = (id: string) => {
    onChange(links.filter((link) => link.id !== id));
  };

  const addLink = () => {
    onChange([
      ...links,
      {
        id: nanoid(),
        title: '',
        url: '',
      },
    ]);
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <div>
          <Text size="sm" fw={500}>
            Ссылки
          </Text>
          <Text size="xs" c="dimmed">
            Название отображается в документе, по клику открывается URL
          </Text>
        </div>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={addLink}
        >
          Добавить ссылку
        </Button>
      </Group>

      {links.length === 0 ? (
        <Text size="sm" c="dimmed">
          Ссылок пока нет
        </Text>
      ) : (
        <Stack gap="xs">
          {links.map((link, index) => (
            <Group key={link.id} align="flex-start" wrap="nowrap" gap="xs">
              <IconLink size={16} style={{ marginTop: 10, flexShrink: 0, opacity: 0.55 }} />
              <TextInput
                placeholder={`Название ссылки ${index + 1}`}
                value={link.title}
                onChange={(event) => {
                  const next = event.currentTarget?.value ?? event.target?.value ?? '';
                  updateLink(link.id, { title: next });
                }}
                style={{ flex: 1 }}
              />
              <TextInput
                placeholder="https://…"
                value={link.url}
                onChange={(event) => {
                  const next = event.currentTarget?.value ?? event.target?.value ?? '';
                  updateLink(link.id, { url: next });
                }}
                onBlur={() => {
                  const normalized = normalizeUrlInput(link.url);
                  if (normalized !== link.url) {
                    updateLink(link.id, { url: normalized });
                  }
                }}
                style={{ flex: 1.4 }}
              />
              <Tooltip label="Удалить ссылку">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  mt={4}
                  onClick={() => removeLink(link.id)}
                  aria-label="Удалить ссылку"
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
