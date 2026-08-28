import { nanoid } from 'nanoid';
import type { ImageAttachment, TestAttachment } from '@/domain/types';
import { isImageAttachment } from '@/domain/types/attachment';

export async function fileToImageAttachment(file: File): Promise<ImageAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

  return {
    id: nanoid(),
    kind: 'image',
    fileName: file.name || `screenshot-${Date.now()}.png`,
    mimeType: file.type || 'image/png',
    dataUrl,
    caption: '',
    createdAt: new Date().toISOString(),
  };
}

export function extractImageFilesFromClipboard(clipboardData: DataTransfer | null): File[] {
  if (!clipboardData) {
    return [];
  }

  const files: File[] = [];

  for (const item of clipboardData.items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }
  }

  if (files.length === 0) {
    for (const file of clipboardData.files) {
      if (file.type.startsWith('image/')) {
        files.push(file);
      }
    }
  }

  return files;
}

export function splitAttachments(value: TestAttachment[]): {
  images: ImageAttachment[];
  others: TestAttachment[];
} {
  const images: ImageAttachment[] = [];
  const others: TestAttachment[] = [];

  for (const item of value) {
    if (isImageAttachment(item)) {
      images.push(item);
    } else {
      others.push(item);
    }
  }

  return { images, others };
}

export function mergeImagesIntoAttachments(
  all: TestAttachment[],
  images: ImageAttachment[],
): TestAttachment[] {
  const { others } = splitAttachments(all);
  return [...images, ...others];
}

export function reorderImages(
  images: ImageAttachment[],
  fromIndex: number,
  toIndex: number,
): ImageAttachment[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= images.length ||
    toIndex >= images.length ||
    fromIndex === toIndex
  ) {
    return images;
  }

  const next = [...images];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
