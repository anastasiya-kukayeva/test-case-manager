import { Badge, Divider, Group, Image, Modal, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { PhotoProvider, PhotoSlider, PhotoView } from 'react-photo-view';
import type { TestCaseEditorFormValues } from '@/domain/schemas/testCaseSchema';
import { isImageAttachment } from '@/domain/types/attachment';
import 'react-photo-view/dist/react-photo-view.css';
import '@/components/editor/formRichTextEditor.css';

type TestCasePreviewProps = {
  opened: boolean;
  onClose: () => void;
  values: TestCaseEditorFormValues;
  taskName?: string;
};

function extractImageSrcs(html: string): string[] {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return Array.from(doc.querySelectorAll('img'))
    .map((img) => img.getAttribute('src') || '')
    .filter(Boolean);
}

export function TestCasePreview({ opened, onClose, values, taskName }: TestCasePreviewProps) {
  const verificationImageSrcs = useMemo(
    () => extractImageSrcs(values.verificationResult.html),
    [values.verificationResult.html],
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  return (
    <Modal opened={opened} onClose={onClose} title="Предпросмотр документа" size="xl" centered>
      <Stack gap="md">
        <div>
          <Title order={3}>
            {values.title.trim() && values.title.trim() !== values.number.trim()
              ? `Тест №${values.number}. ${values.title}`
              : `Тест №${values.number}`}
          </Title>
          <Group gap="xs" mt="xs">
            {taskName ? <Badge variant="light">Задача: {taskName}</Badge> : null}
            {values.testOutcome === 'passed' ? (
              <Badge color="green">Успешно</Badge>
            ) : values.testOutcome === 'failed' ? (
              <Badge color="red">Неуспешно</Badge>
            ) : null}
          </Group>
        </div>

        <Divider label="Цель" labelPosition="left" />
        <div dangerouslySetInnerHTML={{ __html: values.goal.html || '<p>—</p>' }} />
        <PhotoProvider>
          <Group>
            {values.goalImages.filter(isImageAttachment).map((image) => (
              <PhotoView key={image.id} src={image.dataUrl}>
                <Image
                  src={image.dataUrl}
                  alt={image.caption || image.fileName}
                  w={image.displayWidth ?? 220}
                  maw="100%"
                  radius="md"
                  style={{ cursor: 'zoom-in' }}
                />
              </PhotoView>
            ))}
          </Group>
        </PhotoProvider>

        <Divider label="Предварительные условия" labelPosition="left" />
        <Text style={{ whiteSpace: 'pre-wrap' }}>{values.preconditions || '—'}</Text>

        <Divider label="Шаги тестирования" labelPosition="left" />
        <div dangerouslySetInnerHTML={{ __html: values.steps.html || '<p>—</p>' }} />

        <Divider label="Результат проверки" labelPosition="left" />
        <div
          className="tcm-rich-text-editor tcm-rich-text-preview--zoomable"
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof HTMLImageElement)) {
              return;
            }
            const src = target.getAttribute('src') || target.src;
            if (!src) {
              return;
            }
            event.preventDefault();
            const index = verificationImageSrcs.indexOf(src);
            setLightboxIndex(index >= 0 ? index : 0);
            setLightboxOpen(true);
          }}
          dangerouslySetInnerHTML={{
            __html: values.verificationResult.html || '<p>—</p>',
          }}
        />

        <PhotoSlider
          images={verificationImageSrcs.map((src, index) => ({ src, key: String(index) }))}
          visible={lightboxOpen}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      </Stack>
    </Modal>
  );
}
