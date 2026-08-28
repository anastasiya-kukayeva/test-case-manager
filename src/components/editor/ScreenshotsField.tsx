import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  IconClipboard,
  IconPhoto,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useCallback, useRef, useState } from 'react';
import { PhotoProvider } from 'react-photo-view';
import {
  extractImageFilesFromClipboard,
  fileToImageAttachment,
  mergeImagesIntoAttachments,
  splitAttachments,
} from '@/application/testCases/screenshotHelpers';
import { ScreenshotThumb } from '@/components/editor/ScreenshotThumb';
import type { ImageAttachment, TestAttachment } from '@/domain/types';
import 'react-photo-view/dist/react-photo-view.css';
import '@/components/editor/screenshotsField.css';

type ScreenshotsFieldProps = {
  value: TestAttachment[];
  onChange: (value: TestAttachment[]) => void;
  label?: string;
  description?: string;
};

export function ScreenshotsField({
  value,
  onChange,
  label = 'Скриншоты',
  description = 'Drag & Drop, выбор файлов или Ctrl+V (когда область в фокусе)',
}: ScreenshotsFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { images } = splitAttachments(value);
  const activeImage = images.find((item) => item.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const commitImages = useCallback(
    (nextImages: ImageAttachment[]) => {
      onChange(mergeImagesIntoAttachments(value, nextImages));
    },
    [onChange, value],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      try {
        const nextImages = await Promise.all(files.map((file) => fileToImageAttachment(file)));
        commitImages([...images, ...nextImages]);
        notifications.show({
          message:
            nextImages.length === 1
              ? 'Скриншот добавлен'
              : `Добавлено скриншотов: ${nextImages.length}`,
          color: 'green',
          autoClose: 2000,
        });
      } catch {
        notifications.show({
          title: 'Ошибка',
          message: 'Не удалось добавить изображение',
          color: 'red',
        });
      }
    },
    [commitImages, images],
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLDivElement>) => {
      const files = extractImageFilesFromClipboard(event.clipboardData);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      await addFiles(files);
    },
    [addFiles],
  );

  const updateCaption = (id: string, caption: string) => {
    commitImages(images.map((item) => (item.id === id ? { ...item, caption } : item)));
  };

  const updateDisplayWidth = (id: string, displayWidth: number) => {
    commitImages(images.map((item) => (item.id === id ? { ...item, displayWidth } : item)));
  };

  const removeImage = (id: string) => {
    commitImages(images.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    commitImages([]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = images.findIndex((item) => item.id === active.id);
    const newIndex = images.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    commitImages(arrayMove(images, oldIndex, newIndex));
  };

  return (
    <Stack
      gap="sm"
      ref={containerRef}
      tabIndex={0}
      className={`tcm-screenshots-zone ${focused ? 'is-paste-ready' : ''}`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPaste={(event) => void handlePaste(event)}
    >
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text size="sm" fw={500}>
            {label}
          </Text>
          <Badge size="sm" variant="light">
            {images.length}
          </Badge>
        </Group>
        <Group gap="xs">
          <Tooltip label="Кликните по области и нажмите Ctrl+V">
            <Badge
              size="sm"
              variant={focused ? 'filled' : 'outline'}
              leftSection={<IconClipboard size={12} />}
              color={focused ? 'blue' : 'gray'}
            >
              {focused ? 'Ctrl+V готов' : 'Ctrl+V'}
            </Badge>
          </Tooltip>
          {images.length > 0 ? (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={clearAll}
            >
              Удалить все
            </Button>
          ) : null}
        </Group>
      </Group>

      <Text size="xs" c="dimmed">
        {description}
      </Text>

      <Dropzone
        onDrop={(files) => void addFiles(files)}
        accept={IMAGE_MIME_TYPE}
        maxSize={12 * 1024 * 1024}
        multiple
      >
        <Group justify="center" gap="xl" mih={110} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload size={34} stroke={1.5} />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={34} stroke={1.5} />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto size={34} stroke={1.5} />
          </Dropzone.Idle>
          <div>
            <Text size="sm" inline>
              Перетащите изображения сюда или нажмите для выбора
            </Text>
            <Text size="xs" c="dimmed" inline mt={4}>
              PNG, JPG, WEBP, GIF · до 12 МБ · несколько файлов
            </Text>
          </div>
        </Group>
      </Dropzone>

      {images.length > 0 ? (
        <PhotoProvider
          maskOpacity={0.75}
          bannerVisible
          toolbarRender={({ index }) => (
            <Text size="sm" c="white">
              {index + 1} / {images.length}
              {images[index]?.caption ? ` · ${images[index].caption}` : ''}
            </Text>
          )}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={images.map((item) => item.id)} strategy={rectSortingStrategy}>
              <Group gap="md" align="flex-start">
                {images.map((image, index) => (
                  <ScreenshotThumb
                    key={image.id}
                    image={image}
                    index={index}
                    onCaptionChange={(caption) => updateCaption(image.id, caption)}
                    onDisplayWidthChange={(displayWidth) =>
                      updateDisplayWidth(image.id, displayWidth)
                    }
                    onRemove={() => removeImage(image.id)}
                  />
                ))}
              </Group>
            </SortableContext>

            <DragOverlay>
              {activeImage ? (
                <Card withBorder padding="xs" radius="md" className="tcm-screenshot-overlay">
                  <Image src={activeImage.dataUrl} h={100} fit="cover" radius="sm" />
                  <Text size="xs" mt={4} lineClamp={1}>
                    {activeImage.caption || activeImage.fileName}
                  </Text>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>
        </PhotoProvider>
      ) : (
        <Text size="sm" c="dimmed">
          Скриншоты ещё не добавлены
        </Text>
      )}
    </Stack>
  );
}

/** @deprecated use ScreenshotsField */
export const ImageAttachmentsField = ScreenshotsField;
