import { nanoid } from 'nanoid';
import { AppError } from '@/application/errors/AppError';
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

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new AppError('VALIDATION', 'Некорректные данные изображения');
  }

  const mimeType = match[1] || 'image/png';
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') {
    return blob;
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new AppError('UNKNOWN', 'Не удалось подготовить изображение для копирования');
    }
    ctx.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (!png) {
      throw new AppError('UNKNOWN', 'Не удалось подготовить изображение для копирования');
    }
    return png;
  } finally {
    bitmap.close();
  }
}

/** Copy a screenshot (data URL or regular image URL) to the system clipboard as PNG. */
export async function copyImageDataUrlToClipboard(src: string): Promise<void> {
  const trimmed = src.trim();
  if (!trimmed) {
    throw new AppError('VALIDATION', 'Нет изображения для копирования');
  }

  let blob: Blob;
  if (trimmed.startsWith('data:')) {
    blob = dataUrlToBlob(trimmed);
  } else {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new AppError('UNKNOWN', 'Не удалось прочитать изображение');
    }
    blob = await response.blob();
  }
  const pngBlob = await toPngBlob(blob);

  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new AppError('IPC_UNAVAILABLE', 'Копирование в буфер обмена недоступно');
  }

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}
