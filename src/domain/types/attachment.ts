import type { AttachmentKind, CodeLanguage } from '@/domain/types/enums';

export type ImageAttachment = {
  id: string;
  kind: 'image';
  fileName: string;
  mimeType: string;
  dataUrl: string;
  caption?: string;
  /** Display width in the editor (px). Does not affect export quality. */
  displayWidth?: number;
  createdAt: string;
};

export type CodeAttachment = {
  id: string;
  kind: 'code';
  language: CodeLanguage;
  content: string;
  createdAt: string;
};

export type LogAttachment = {
  id: string;
  kind: 'log';
  content: string;
  createdAt: string;
};

export type TestAttachment = ImageAttachment | CodeAttachment | LogAttachment;

export function isImageAttachment(attachment: TestAttachment): attachment is ImageAttachment {
  return attachment.kind === 'image';
}

export function isCodeAttachment(attachment: TestAttachment): attachment is CodeAttachment {
  return attachment.kind === 'code';
}

export function isLogAttachment(attachment: TestAttachment): attachment is LogAttachment {
  return attachment.kind === 'log';
}

export type AttachmentMeta = {
  kind: AttachmentKind;
};
