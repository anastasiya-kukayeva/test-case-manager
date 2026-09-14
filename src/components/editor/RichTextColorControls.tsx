import { ActionIcon, ColorSwatch, Group, Popover, Stack, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconHighlight, IconPalette, IconX } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';

const TEXT_COLORS = [
  { label: 'Красный', value: '#c92a2a' },
  { label: 'Оранжевый', value: '#e8590c' },
  { label: 'Жёлтый', value: '#f08c00' },
  { label: 'Зелёный', value: '#2f9e44' },
  { label: 'Синий', value: '#1971c2' },
  { label: 'Фиолетовый', value: '#9c36b5' },
  { label: 'Серый', value: '#868e96' },
] as const;

const HIGHLIGHT_COLORS = [
  { label: 'Жёлтый', value: '#fff3bf' },
  { label: 'Зелёный', value: '#d3f9d8' },
  { label: 'Голубой', value: '#c5f6fa' },
  { label: 'Розовый', value: '#ffdeeb' },
  { label: 'Оранжевый', value: '#ffe8cc' },
  { label: 'Синий', value: '#d0ebff' },
] as const;

function sameColor(left: string | null | undefined, right: string): boolean {
  return (left ?? '').trim().toLowerCase() === right.toLowerCase();
}

type PaletteSwatchProps = {
  color: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

function PaletteSwatch({ color, label, active, onSelect }: PaletteSwatchProps) {
  return (
    <Tooltip label={label}>
      <ColorSwatch
        component="button"
        type="button"
        color={color}
        size={22}
        radius="sm"
        aria-label={label}
        withShadow={false}
        style={{
          cursor: 'pointer',
          border: active
            ? '2px solid var(--mantine-color-blue-6)'
            : '1px solid var(--mantine-color-default-border)',
        }}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={onSelect}
      />
    </Tooltip>
  );
}

type RichTextColorControlsProps = {
  editor: Editor | null;
  color: string | null;
  highlight: string | null;
};

export function RichTextColorControls({ editor, color, highlight }: RichTextColorControlsProps) {
  const disabled = !editor;

  return (
    <>
      <Popover position="bottom-start" shadow="md" withArrow>
        <Popover.Target>
          <ActionIcon
            variant={color ? 'filled' : 'default'}
            disabled={disabled}
            aria-label="Цвет текста"
            title="Цвет текста"
            onMouseDown={(event) => event.preventDefault()}
          >
            <IconPalette size={16} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown p="sm">
          <Stack gap={8}>
            <Text size="xs" c="dimmed" fw={600}>
              Цвет текста
            </Text>
            <Group gap={6}>
              {TEXT_COLORS.map((item) => (
                <PaletteSwatch
                  key={item.value}
                  color={item.value}
                  label={item.label}
                  active={sameColor(color, item.value)}
                  onSelect={() => {
                    if (sameColor(color, item.value)) {
                      editor?.chain().focus().unsetColor().run();
                      return;
                    }
                    editor?.chain().focus().setColor(item.value).run();
                  }}
                />
              ))}
              <Tooltip label="Сбросить цвет">
                <UnstyledButton
                  aria-label="Сбросить цвет"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().unsetColor().run()}
                  style={{
                    width: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    border: '1px solid var(--mantine-color-default-border)',
                    background: 'var(--mantine-color-body)',
                  }}
                >
                  <IconX size={12} />
                </UnstyledButton>
              </Tooltip>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>

      <Popover position="bottom-start" shadow="md" withArrow>
        <Popover.Target>
          <ActionIcon
            variant={highlight ? 'filled' : 'default'}
            disabled={disabled}
            aria-label="Цвет выделения"
            title="Цвет выделения"
            onMouseDown={(event) => event.preventDefault()}
          >
            <IconHighlight size={16} />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown p="sm">
          <Stack gap={8}>
            <Text size="xs" c="dimmed" fw={600}>
              Маркер
            </Text>
            <Group gap={6}>
              {HIGHLIGHT_COLORS.map((item) => (
                <PaletteSwatch
                  key={item.value}
                  color={item.value}
                  label={item.label}
                  active={sameColor(highlight, item.value)}
                  onSelect={() => {
                    if (sameColor(highlight, item.value)) {
                      editor?.chain().focus().unsetHighlight().run();
                      return;
                    }
                    editor?.chain().focus().toggleHighlight({ color: item.value }).run();
                  }}
                />
              ))}
              <Tooltip label="Снять выделение">
                <UnstyledButton
                  aria-label="Снять выделение"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().unsetHighlight().run()}
                  style={{
                    width: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    border: '1px solid var(--mantine-color-default-border)',
                    background: 'var(--mantine-color-body)',
                  }}
                >
                  <IconX size={12} />
                </UnstyledButton>
              </Tooltip>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
