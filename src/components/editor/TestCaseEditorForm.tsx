import {
  Accordion,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { IconDeviceFloppy, IconEye } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  testCaseToFormValues,
} from '@/application/testCases/testCaseFormMapper';
import { EditorSection } from '@/components/editor/EditorSection';
import { FormRichTextEditor } from '@/components/editor/FormRichTextEditor';
import { ScreenshotsField } from '@/components/editor/ScreenshotsField';
import { TestCasePreview } from '@/components/editor/TestCasePreview';
import { TestOutcomeSelector } from '@/components/editor/TestOutcomeSelector';
import {
  testCaseEditorSchema,
  type TestCaseEditorFormValues,
} from '@/domain/schemas/testCaseSchema';
import type { TestCase } from '@/domain/types';

type TestCaseEditorFormProps = {
  testCase: TestCase;
  taskName?: string;
  onSave: (values: TestCaseEditorFormValues) => void;
  onAutoSave: (values: TestCaseEditorFormValues) => void;
  /** Registers a sync flush of the current draft into the task (call before leave). */
  onRegisterFlush?: (flush: () => void) => void;
};

export function TestCaseEditorForm({
  testCase,
  taskName,
  onSave,
  onAutoSave,
  onRegisterFlush,
}: TestCaseEditorFormProps) {
  const [previewOpened, setPreviewOpened] = useState(false);
  const defaultValues = useMemo(() => testCaseToFormValues(testCase), [testCase]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<TestCaseEditorFormValues>({
    resolver: zodResolver(testCaseEditorSchema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    reset(testCaseToFormValues(testCase));
    // Reset only when switching to another test case, not on autosave updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testCase.id, reset]);

  const values = watch();
  const valuesRef = useRef(values);
  const isDirtyRef = useRef(isDirty);
  valuesRef.current = values;
  isDirtyRef.current = isDirty;

  const flushDraft = () => {
    if (!isDirtyRef.current) {
      return;
    }
    const draft = valuesRef.current;
    const parsed = testCaseEditorSchema.safeParse(draft);
    onAutoSave(parsed.success ? parsed.data : draft);
    reset(parsed.success ? parsed.data : draft, { keepValues: true });
  };

  useEffect(() => {
    onRegisterFlush?.(flushDraft);
  });

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const timer = window.setTimeout(() => {
      const parsed = testCaseEditorSchema.safeParse(values);
      if (parsed.success) {
        onAutoSave(parsed.data);
        // Update defaults only — do not push HTML back into TipTap (causes dispatchTransaction crash).
        reset(parsed.data, { keepValues: true });
      } else {
        // Keep a draft even if some step fields are temporarily empty.
        onAutoSave(values);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [values, isDirty, onAutoSave, reset]);

  const handleManualSave = handleSubmit((data) => {
    onSave(data);
    reset(data);
  });

  return (
    <>
      <form onSubmit={(event) => void handleManualSave(event)}>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700} size="lg">
                Редактор тест-кейса
              </Text>
              <Text size="sm" c="dimmed">
                {taskName ? `Задача: ${taskName}` : null}
                {isDirty ? ' · есть несохранённые изменения (автосохранение…)' : ' · изменения сохранены в задачу'}
              </Text>
            </div>
            <Group>
              <Button
                variant="default"
                leftSection={<IconEye size={16} />}
                onClick={() => setPreviewOpened(true)}
              >
                Предпросмотр
              </Button>
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />}>
                Сохранить
              </Button>
            </Group>
          </Group>

          <Accordion
            multiple
            defaultValue={[
              'header',
              'goal',
              'preconditions',
              'steps',
              'verification',
              'outcome',
              'regression',
            ]}
          >
            <EditorSection value="header" title="1. Заголовок теста" description="Номер теста">
              <Controller
                name="number"
                control={control}
                render={({ field }) => (
                  <TextInput
                    label="Тест №"
                    required
                    error={errors.number?.message}
                    maw={320}
                    {...field}
                  />
                )}
              />
            </EditorSection>

            <EditorSection value="goal" title="2. Цель" description="Описание сценария и изображения">
              <Controller
                name="goal"
                control={control}
                render={({ field }) => (
                  <FormRichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Опишите цель теста…"
                    error={errors.goal?.message || errors.goal?.root?.message}
                  />
                )}
              />
              <div style={{ marginTop: 16 }}>
                <Controller
                  name="goalImages"
                  control={control}
                  render={({ field }) => (
                    <ScreenshotsField
                      label="Изображения к цели"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </EditorSection>

            <EditorSection
              value="preconditions"
              title="3. Предварительные условия"
              description="Что должно быть подготовлено до теста"
            >
              <Controller
                name="preconditions"
                control={control}
                render={({ field }) => (
                  <Textarea
                    minRows={4}
                    autosize
                    placeholder="Например: пользователь авторизован; создан тестовый объект…"
                    {...field}
                  />
                )}
              />
            </EditorSection>

            <EditorSection
              value="steps"
              title="4. Шаги тестирования"
              description="Опишите шаги текстом; при необходимости включите нумерованный список"
            >
              <Controller
                name="steps"
                control={control}
                render={({ field }) => (
                  <FormRichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Опишите шаги тестирования…"
                    minHeight={180}
                    error={
                      typeof errors.steps?.message === 'string'
                        ? errors.steps.message
                        : errors.steps?.root?.message || errors.steps?.plainText?.message
                    }
                  />
                )}
              />
            </EditorSection>

            <EditorSection
              value="verification"
              title="5. Результат проверки"
              description="Текст, скриншоты, код и логи — в одном поле"
            >
              <Controller
                name="verificationResult"
                control={control}
                render={({ field }) => (
                  <FormRichTextEditor
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Опишите результат, вставьте скриншот или выделите текст и нажмите «Код» / «Лог»…"
                    minHeight={220}
                    maxHeight={420}
                    allowImages
                    allowCodeAndLogs
                  />
                )}
              />
            </EditorSection>

            <EditorSection value="outcome" title="6. Результат тестирования">
              <Controller
                name="testOutcome"
                control={control}
                render={({ field }) => (
                  <TestOutcomeSelector value={field.value} onChange={field.onChange} />
                )}
              />
            </EditorSection>

            <EditorSection
              value="regression"
              title="7. Регресс"
              description="Отметка для будущей выгрузки. Сейчас ни на что не влияет"
            >
              <Controller
                name="includeInRegression"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    label="Добавить в регресс?"
                    checked={field.value}
                    onChange={(event) => {
                      field.onChange(event.currentTarget.checked);
                    }}
                  />
                )}
              />
            </EditorSection>
          </Accordion>
        </Stack>
      </form>

      <TestCasePreview
        opened={previewOpened}
        onClose={() => setPreviewOpened(false)}
        values={values}
        taskName={taskName}
      />
    </>
  );
}
