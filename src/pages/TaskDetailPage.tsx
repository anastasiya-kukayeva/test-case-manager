import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconFileWord,
  IconListDetails,
  IconX,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportActions } from '@/application/export/exportActions';
import { projectActions } from '@/application/project/projectActions';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { DirectoryApplicationSelect } from '@/components/directory/DirectoryApplicationSelect';
import { TestObjectLinksField } from '@/components/project/TestObjectLinksField';
import { FadeIn } from '@/components/ui/FadeIn';
import { getTaskShortLabel } from '@/domain/utils/taskDisplay';
import { AppRoutes } from '@/routes/paths';
import { useProjectStore } from '@/stores/useProjectStore';

export function TaskDetailPage() {
  const navigate = useNavigate();
  const current = useProjectStore((state) => state.current);
  const updateProjectMeta = useProjectStore((state) => state.updateProjectMeta);
  const leavingRef = useRef(false);

  const leaveTaskPage = useCallback(
    async (to: string) => {
      if (leavingRef.current) {
        return;
      }
      leavingRef.current = true;
      try {
        await projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
        void navigate(to);
      } finally {
        leavingRef.current = false;
      }
    },
    [navigate],
  );

  useEffect(() => {
    return () => {
      void projectActions.saveIfDirty({ silent: true, allowSaveAs: true });
    };
  }, []);

  if (!current) {
    return (
      <Stack gap="lg">
        <FadeIn>
          <Title order={2}>Текущая задача</Title>
          <Text c="dimmed" mt="xs">
            Задача не выбрана. Откройте её из списка задач.
          </Text>
        </FadeIn>
        <Button
          w="fit-content"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => void navigate(AppRoutes.tasks)}
        >
          К списку задач
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <FadeIn>
        <Group justify="space-between" align="flex-start">
          <div>
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconArrowLeft size={16} />}
              mb="xs"
              onClick={() => void leaveTaskPage(AppRoutes.tasks)}
            >
              К списку задач
            </Button>
            <Title order={2}>{getTaskShortLabel(current.document.meta)}</Title>
            <Text c="dimmed" mt="xs">
              Текущая задача
            </Text>
          </div>
          <Group gap="xs">
            <Button
              size="sm"
              variant="filled"
              leftSection={<IconListDetails size={14} />}
              onClick={() => void leaveTaskPage(AppRoutes.testCases)}
            >
              Тест-кейсы задачи
            </Button>
            <Button
              size="sm"
              variant="light"
              leftSection={<IconFileWord size={14} />}
              onClick={() => void exportActions.exportTaskToDocx()}
            >
              Экспорт Word
            </Button>
            <Button
              size="sm"
              variant="light"
              leftSection={<IconDeviceFloppy size={14} />}
              onClick={() => void leaveTaskPage(AppRoutes.tasks)}
            >
              Сохранить
            </Button>
            <Button
              size="sm"
              variant="light"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() =>
                void projectActions.close().then((ok) => {
                  if (ok) {
                    void navigate(AppRoutes.tasks);
                  }
                })
              }
            >
              Закрыть
            </Button>
          </Group>
        </Group>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card withBorder padding="lg" radius="lg">
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color={current.isDirty ? 'orange' : 'green'} variant="light">
                {current.isDirty ? 'Есть изменения' : 'Сохранено'}
              </Badge>
              {current.lastSavedAt ? (
                <Text size="xs" c="dimmed">
                  Последнее сохранение:{' '}
                  {dayjs(current.lastSavedAt).format('DD.MM.YYYY HH:mm:ss')}
                </Text>
              ) : null}
            </Group>

            <Textarea
              label="Название задачи"
              description="Текстовое поле, до 2000 символов"
              value={current.document.meta.name}
              onChange={(event) => {
                const value = event.currentTarget?.value ?? event.target?.value ?? '';
                updateProjectMeta({ name: value });
              }}
              minRows={3}
              autosize
              maxRows={8}
              maxLength={2000}
            />
            <TextInput
              label="Краткое название"
              description="Для меню и списков, до 80 символов"
              placeholder="Например: Релиз 2"
              value={current.document.meta.shortName ?? ''}
              onChange={(event) => {
                const value = event.currentTarget?.value ?? event.target?.value ?? '';
                updateProjectMeta({ shortName: value });
              }}
              maxLength={80}
            />
            <DirectoryApplicationSelect
              value={current.document.meta.application ?? ''}
              onChange={(application) => updateProjectMeta({ application })}
            />
            <Textarea
              label="Объект испытаний"
              description="Описание объекта; ссылки задаются отдельно ниже"
              value={current.document.meta.testObject}
              onChange={(event) => {
                const value = event.currentTarget?.value ?? event.target?.value ?? '';
                updateProjectMeta({ testObject: value });
              }}
              minRows={2}
              autosize
            />
            <TestObjectLinksField
              value={current.document.meta.testObjectLinks ?? []}
              onChange={(testObjectLinks) => updateProjectMeta({ testObjectLinks })}
            />
            <div>
              <Text size="sm" fw={500} mb={6}>
                Цель испытаний
              </Text>
              <FormRichTextEditor
                value={current.document.meta.testGoal}
                onChange={(testGoal) => updateProjectMeta({ testGoal })}
                placeholder="Цель испытаний…"
                minHeight={100}
              />
            </div>
            <Textarea
              label="Общие положения"
              value={current.document.meta.generalProvisions}
              onChange={(event) => {
                const value = event.currentTarget?.value ?? event.target?.value ?? '';
                updateProjectMeta({ generalProvisions: value });
              }}
              minRows={2}
              autosize
            />
            <div>
              <Text size="sm" fw={500} mb={6}>
                Требования к функциональности
              </Text>
              <FormRichTextEditor
                value={current.document.meta.functionalRequirements}
                onChange={(functionalRequirements) =>
                  updateProjectMeta({ functionalRequirements })
                }
                placeholder="Требования…"
                minHeight={120}
              />
            </div>

            <Text size="sm" c="dimmed">
              Путь: {current.filePath ?? 'ещё не сохранён на диск'}
            </Text>
            <Text size="sm" c="dimmed">
              Тест-кейсов в задаче: {current.document.testCases.length}
            </Text>
          </Stack>
        </Card>
      </FadeIn>
    </Stack>
  );
}
