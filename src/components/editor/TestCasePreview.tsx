import { Badge, Divider, Group, Image, Modal, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState, type MouseEvent } from 'react';
import { PhotoProvider, PhotoSlider, PhotoView } from 'react-photo-view';
import type { TestCaseEditorFormValues } from '@/domain/schemas/testCaseSchema';
import { normalizeEmbeddedLinkHtml } from '@/domain/utils/embeddedLinks';
import { isImageAttachment } from '@/domain/types/attachment';
import 'react-photo-view/dist/react-photo-view.css';
import '@/components/editor/formRichTextEditor.css';

type TestCasePreviewProps = {
  opened: boolean;
  onClose: () => void;
  values: TestCaseEditorFormValues;
  taskName?: string;
};

function openFieldLink(event: MouseEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const anchor = target.closest('a');
  if (!anchor) {
    return;
  }
  const href = anchor.getAttribute('href');
  if (!href) {
    return;
  }
  event.preventDefault();
  window.open(href, '_blank', 'noopener,noreferrer');
}

function RichHtml({ html }: { html: string }) {
  return (
    <div
      className="tcm-rich-html"
      onClick={openFieldLink}
      dangerouslySetInnerHTML={{ __html: normalizeEmbeddedLinkHtml(html) || '<p>—</p>' }}
    />
  );
}

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
        <RichHtml html={values.goal.html} />
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
        <RichHtml html={values.steps.html} />

        <Divider label="Результат проверки" labelPosition="left" />
        <div
          className="tcm-rich-text-editor tcm-rich-text-preview--zoomable"
          onClick={(event) => {
            openFieldLink(event);
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
            __html: normalizeEmbeddedLinkHtml(values.verificationResult.html) || '<p>—</p>',
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
