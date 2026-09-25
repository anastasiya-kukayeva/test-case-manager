import {
  Button,
  Group,
  Modal,
  SimpleGrid,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useEffect, useState, type ChangeEvent } from 'react';
import { projectActions } from '@/application/project/projectActions';
import { DirectoryApplicationSelect } from '@/components/directory/DirectoryApplicationSelect';
import { DirectoryModuleSelect } from '@/components/directory/DirectoryModuleSelect';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { createEmptyRichText } from '@/domain/factories/createEntities';
import type { RichTextContent } from '@/domain/types';

type CreateProjectModalProps = {
  opened: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** Prefill application from Applications page. */
  initialApplication?: string;
};

type CreateTaskFormState = {
  name: string;
  shortName: string;
  application: string;
  module: string;
  testObject: string;
  testGoal: RichTextContent;
  generalProvisions: string;
  functionalRequirements: RichTextContent;
  risksAndLimitations: RichTextContent;
};

/** Task name must comfortably fit long methodology titles (500+ chars). */
const TASK_NAME_MAX_LENGTH = 2000;
const TASK_SHORT_NAME_MAX_LENGTH = 80;

const emptyForm = (application = ''): CreateTaskFormState => ({
  name: '',
  shortName: '',
  application,
  module: '',
  testObject: '',
  testGoal: createEmptyRichText(),
  generalProvisions: '',
  functionalRequirements: createEmptyRichText(),
  risksAndLimitations: createEmptyRichText(),
});

function readInputValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string {
  // Read synchronously — currentTarget is null if accessed inside setState updater.
  return event.currentTarget?.value ?? event.target?.value ?? '';
}

export function CreateProjectModal({
  opened,
  onClose,
  onCreated,
  initialApplication = '',
}: CreateProjectModalProps) {
  const [form, setForm] = useState<CreateTaskFormState>(emptyForm(initialApplication));
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      setForm(emptyForm(initialApplication.trim()));
      setNameError(null);
      setSubmitting(false);
    }
  }, [opened, initialApplication]);

  const handleClose = () => {
    if (submitting) {
      return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      setNameError('Укажите название задачи');
      return;
    }

    setNameError(null);
    setSubmitting(true);
    const ok = await projectActions.create({
      name,
      shortName: form.shortName.trim(),
      application: form.application.trim(),
      module: form.module.trim(),
      testObject: form.testObject,
      testGoal: form.testGoal,
      generalProvisions: form.generalProvisions,
      functionalRequirements: form.functionalRequirements,
      risksAndLimitations: form.risksAndLimitations,
    });
    setSubmitting(false);

    if (ok) {
      onClose();
      onCreated?.();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Создать задачу"
      centered
      size="xl"
      radius="md"
      padding="lg"
      styles={{
        content: { maxHeight: '90vh' },
        body: { paddingTop: 8 },
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Заполните карточку задачи. Поля со списками поддерживают маркеры и нумерацию.
        </Text>

        <ScrollArea.Autosize mah="calc(90vh - 180px)" type="auto" offsetScrollbars>
          <Stack gap="md" pr="xs">
            <Textarea
              label="Название задачи"
              description={`Текстовое поле, до ${TASK_NAME_MAX_LENGTH} символов`}
              placeholder="Например: Методика испытаний в рамках задачи «Релиз 2. …»"
              value={form.name}
              onChange={(event) => {
                const value = readInputValue(event);
                setForm((prev) => ({ ...prev, name: value }));
                if (nameError) {
                  setNameError(null);
                }
              }}
              required
              error={nameError}
              minRows={3}
              autosize
              maxRows={8}
              maxLength={TASK_NAME_MAX_LENGTH}
              data-autofocus
            />

            <TextInput
              label="Краткое название"
              description="Для меню и списков, до 80 символов"
              placeholder="Например: Релиз 2"
              value={form.shortName}
              onChange={(event) => {
                const value = readInputValue(event);
                setForm((prev) => ({ ...prev, shortName: value }));
              }}
              maxLength={TASK_SHORT_NAME_MAX_LENGTH}
            />

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <DirectoryApplicationSelect
                value={form.application}
                onChange={(application) => setForm((prev) => ({ ...prev, application }))}
              />
              <DirectoryModuleSelect
                value={form.module}
                onChange={(module) => setForm((prev) => ({ ...prev, module }))}
              />
            </SimpleGrid>

            <Textarea
              label="Объект испытаний"
              description="Можно вставлять ссылки (URL) и несколько строк"
              placeholder="https://… или описание объекта"
              value={form.testObject}
              onChange={(event) => {
                const value = readInputValue(event);
                setForm((prev) => ({ ...prev, testObject: value }));
              }}
              minRows={2}
              autosize
              maxRows={8}
            />

            <div>
              <Text size="sm" fw={500} mb={6}>
                Цель испытаний
              </Text>
              <Text size="xs" c="dimmed" mb={6}>
                Поддерживаются маркированные и нумерованные списки
              </Text>
              <FormRichTextEditor
                value={form.testGoal}
                onChange={(testGoal) => setForm((prev) => ({ ...prev, testGoal }))}
                placeholder="Опишите цель… Можно оформить списком"
                minHeight={120}
              />
            </div>

            <Textarea
              label="Общие положения"
              placeholder="Общие условия и вводная информация"
              value={form.generalProvisions}
              onChange={(event) => {
                const value = readInputValue(event);
                setForm((prev) => ({ ...prev, generalProvisions: value }));
              }}
              minRows={3}
              autosize
              maxRows={10}
            />

            <div>
              <Text size="sm" fw={500} mb={6}>
                Требования к функциональности
              </Text>
              <Text size="xs" c="dimmed" mb={6}>
                Поддерживаются маркированные и нумерованные списки
              </Text>
              <FormRichTextEditor
                value={form.functionalRequirements}
                onChange={(functionalRequirements) =>
                  setForm((prev) => ({ ...prev, functionalRequirements }))
                }
                placeholder="Перечислите требования…"
                minHeight={140}
              />
            </div>

            <div>
              <Text size="sm" fw={500} mb={6}>
                Риски и ограничения
              </Text>
              <Text size="xs" c="dimmed" mb={6}>
                Поддерживаются маркированные и нумерованные списки
              </Text>
              <FormRichTextEditor
                value={form.risksAndLimitations}
                onChange={(risksAndLimitations) =>
                  setForm((prev) => ({ ...prev, risksAndLimitations }))
                }
                placeholder="Перечислите риски и ограничения…"
                minHeight={140}
              />
            </div>
          </Stack>
        </ScrollArea.Autosize>

        <Group justify="flex-end" pt="xs">
          <Button variant="default" onClick={handleClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={() => void handleSubmit()} loading={submitting}>
            Создать задачу
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export const CreateTaskModal = CreateProjectModal;
