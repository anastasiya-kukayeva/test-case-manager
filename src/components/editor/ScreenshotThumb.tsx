import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Image,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconArrowsDiagonal2, IconGripVertical, IconTrash, IconZoomIn } from '@tabler/icons-react';
import { PhotoView } from 'react-photo-view';
import { CopyScreenshotButton } from '@/components/editor/CopyScreenshotButton';
import type { ImageAttachment } from '@/domain/types';
import {
  IMAGE_DISPLAY_WIDTH_DEFAULT,
  useImageCornerResize,
} from '@/components/editor/useImageCornerResize';

type ScreenshotThumbProps = {
  image: ImageAttachment;
  index: number;
  onCaptionChange: (caption: string) => void;
  onDisplayWidthChange: (displayWidth: number) => void;
  onRemove: () => void;
};

export function ScreenshotThumb({
  image,
  index,
  onCaptionChange,
  onDisplayWidthChange,
  onRemove,
}: ScreenshotThumbProps) {
  const displayWidth = image.displayWidth ?? IMAGE_DISPLAY_WIDTH_DEFAULT;
  const imageHeight = Math.round(displayWidth * 0.6);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const { resizing, onResizePointerDown } = useImageCornerResize({
    width: displayWidth,
    onWidthChange: onDisplayWidthChange,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: resizing ? undefined : transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <Card
      withBorder
      padding="xs"
      radius="md"
      ref={setNodeRef}
      style={style}
      w={displayWidth}
      className={isDragging ? 'tcm-screenshot-dragging' : undefined}
    >
      <Stack gap={6}>
        <Group justify="space-between" gap={4}>
          <Group gap={4}>
            <ActionIcon
              size="sm"
              variant="subtle"
              {...attributes}
              {...listeners}
              aria-label="Перетащить скриншот"
              style={{ cursor: 'grab' }}
            >
              <IconGripVertical size={14} />
            </ActionIcon>
            <Badge size="xs" variant="light">
              #{index + 1}
            </Badge>
          </Group>
          <Group gap={4} wrap="nowrap">
            <CopyScreenshotButton src={image.dataUrl} />
            <Tooltip label="Удалить">
              <ActionIcon size="sm" color="red" variant="subtle" onClick={onRemove}>
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <PhotoView src={image.dataUrl}>
          <div className={`tcm-screenshot-thumb${resizing ? ' is-resizing' : ''}`}>
            <Image
              src={image.dataUrl}
              alt={image.caption || image.fileName}
              radius="sm"
              h={imageHeight}
              fit="cover"
            />
            <div className="tcm-screenshot-zoom">
              <IconZoomIn size={18} />
            </div>
            <div
              className="tcm-screenshot-actions"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <CopyScreenshotButton src={image.dataUrl} variant="filled" color="dark" radius="xl" />
              <Tooltip label="Удалить">
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="filled"
                  radius="xl"
                  aria-label="Удалить скриншот"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemove();
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
            <Tooltip label="Изменить размер">
              <button
                type="button"
                className="tcm-image-resize-handle"
                aria-label="Изменить размер изображения"
                onPointerDown={onResizePointerDown}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <IconArrowsDiagonal2 size={12} stroke={2.2} />
              </button>
            </Tooltip>
          </div>
        </PhotoView>

        <TextInput
          size="xs"
          label="Подпись"
          placeholder="Описание скриншота"
          value={image.caption ?? ''}
          onChange={(event) => onCaptionChange(event.currentTarget.value)}
        />
        <Text size="xs" c="dimmed" lineClamp={1} title={image.fileName}>
          {image.fileName}
        </Text>
      </Stack>
    </Card>
  );
}
