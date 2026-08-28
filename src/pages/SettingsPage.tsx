import {
  Button,
  Card,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconDeviceFloppy,
  IconFolder,
  IconFolderOff,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { notifySuccess } from '@/application/errors/errorHandler';
import { settingsActions } from '@/application/settings/settingsActions';
import type { HotkeySettings } from '@/domain/types';
import { useColorSchemePreference } from '@/hooks/useColorSchemePreference';
import { useAppStore } from '@/stores/useAppStore';
import { HOTKEY_FIELD_LABELS } from '@/utils/hotkeys';
import type { ColorSchemePreference } from '@/theme/types';

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const recentCount = useAppStore((state) => state.recentProjects.length);
  const { colorScheme, setColorScheme: persistColorScheme } = useColorSchemePreference();
  const { setColorScheme } = useMantineColorScheme();

  const [hotkeyDraft, setHotkeyDraft] = useState<HotkeySettings>(settings.hotkeys);
  const [savingHotkeys, setSavingHotkeys] = useState(false);

  useEffect(() => {
    setHotkeyDraft(settings.hotkeys);
  }, [settings.hotkeys]);

  const handleThemeChange = (value: string) => {
    const next = value as ColorSchemePreference;
    persistColorScheme(next);
    if (next === 'auto') {
      setColorScheme('auto');
    } else {
      setColorScheme(next);
    }
    notifySuccess(
      next === 'auto'
        ? 'Тема: как в системе'
        : next === 'dark'
          ? 'Включена тёмная тема'
          : 'Включена светлая тема',
    );
  };

  const handleSaveHotkeys = async () => {
    setSavingHotkeys(true);
    try {
      const ok = await settingsActions.updateHotkeys(hotkeyDraft);
      if (ok) {
        notifySuccess('Горячие клавиши сохранены');
      }
    } finally {
      setSavingHotkeys(false);
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Настройки</Title>
        <Text c="dimmed" mt="xs">
          Тема, хранение задач, автосохранение, экспорт и горячие клавиши.
        </Text>
      </div>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text fw={600}>Оформление</Text>
          <div>
            <Text size="sm" mb={6}>
              Тема Mantine
            </Text>
            <SegmentedControl
              value={colorScheme}
              onChange={handleThemeChange}
              data={[
                { label: 'Светлая', value: 'light' },
                { label: 'Тёмная', value: 'dark' },
                { label: 'Системная', value: 'auto' },
              ]}
            />
          </div>
          <Select
            label="Локаль дат"
            description="Влияет на формат календаря и dayjs"
            data={[
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ]}
            value={settings.locale}
            onChange={(value) => {
              if (value === 'ru' || value === 'en') {
                void settingsActions.updateLocale(value).then(() =>
                  notifySuccess(value === 'ru' ? 'Локаль: ru' : 'Locale: en'),
                );
              }
            }}
            allowDeselect={false}
            w={220}
          />
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text fw={600}>Хранение</Text>
          <TextInput
            label="Папка задач по умолчанию"
            description="Используется в диалогах «Открыть» и «Сохранить как»"
            value={settings.storage.defaultProjectsDirectory ?? ''}
            readOnly
            placeholder="Не задана"
          />
          <Group>
            <Button
              leftSection={<IconFolder size={16} />}
              variant="light"
              onClick={() => void settingsActions.pickDefaultDirectory()}
            >
              Выбрать папку
            </Button>
            <Button
              leftSection={<IconFolderOff size={16} />}
              variant="default"
              disabled={!settings.storage.defaultProjectsDirectory}
              onClick={() => void settingsActions.clearDefaultDirectory()}
            >
              Сбросить
            </Button>
          </Group>
          <Switch
            label="Запоминать последнюю открытую задачу"
            description="При запуске приложение предложит открыть её снова (если нет recovery)"
            checked={settings.storage.rememberLastProject}
            onChange={(event) =>
              void settingsActions.updateStorage({
                rememberLastProject: event.currentTarget.checked,
              })
            }
          />
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text fw={600}>Автосохранение</Text>
          <Switch
            label="Включить автосохранение"
            description="Периодическое сохранение в файл и snapshot для восстановления после сбоя"
            checked={settings.autosave.enabled}
            onChange={(event) =>
              void settingsActions.updateAutosave({ enabled: event.currentTarget.checked }).then(
                () =>
                  notifySuccess(
                    event.currentTarget.checked
                      ? 'Автосохранение включено'
                      : 'Автосохранение выключено',
                  ),
              )
            }
          />
          <NumberInput
            label="Интервал (секунды)"
            min={5}
            max={600}
            step={5}
            value={settings.autosave.intervalSeconds}
            disabled={!settings.autosave.enabled}
            onChange={(value) => {
              const intervalSeconds = typeof value === 'number' ? value : Number(value);
              if (!Number.isFinite(intervalSeconds) || intervalSeconds < 5) {
                return;
              }
              void settingsActions.updateAutosave({ intervalSeconds });
            }}
            w={220}
          />
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text fw={600}>Экспорт</Text>
          <Switch
            label="Включать изображения"
            checked={settings.export.includeImages}
            onChange={(event) =>
              void settingsActions.updateExport({ includeImages: event.currentTarget.checked })
            }
          />
          <Switch
            label="Включать блоки кода"
            checked={settings.export.includeCodeBlocks}
            onChange={(event) =>
              void settingsActions.updateExport({ includeCodeBlocks: event.currentTarget.checked })
            }
          />
          <Switch
            label="Включать логи"
            checked={settings.export.includeLogs}
            onChange={(event) =>
              void settingsActions.updateExport({ includeLogs: event.currentTarget.checked })
            }
          />
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="md">
          <Text fw={600}>Горячие клавиши</Text>
          <Text size="sm" c="dimmed">
            Формат: Ctrl+клавиша, например Ctrl+S или Ctrl+Shift+S. Изменения применяются после
            сохранения.
          </Text>
          {(Object.keys(HOTKEY_FIELD_LABELS) as Array<keyof HotkeySettings>).map((key) => (
            <TextInput
              key={key}
              label={HOTKEY_FIELD_LABELS[key]}
              value={hotkeyDraft[key]}
              onChange={(event) =>
                setHotkeyDraft((prev) => ({
                  ...prev,
                  [key]: event.currentTarget.value,
                }))
              }
              w={280}
            />
          ))}
          <Group>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              loading={savingHotkeys}
              onClick={() => void handleSaveHotkeys()}
            >
              Сохранить клавиши
            </Button>
            <Button
              variant="default"
              onClick={() => setHotkeyDraft(settings.hotkeys)}
            >
              Отменить
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="sm">
          <Text fw={600}>Данные и сброс</Text>
          <Text size="sm" c="dimmed">
            Недавних задач в списке: {recentCount}
          </Text>
          <Group>
            <Button
              variant="light"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => void settingsActions.clearRecentTasks()}
            >
              Очистить недавние
            </Button>
            <Button
              variant="default"
              color="red"
              leftSection={<IconRestore size={16} />}
              onClick={() => void settingsActions.resetAll()}
            >
              Сбросить все настройки
            </Button>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
