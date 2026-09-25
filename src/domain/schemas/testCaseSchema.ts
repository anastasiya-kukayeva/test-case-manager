import { z } from 'zod';

export const richTextSchema = z.object({
  html: z.string(),
  plainText: z.string(),
});

export const imageAttachmentSchema = z.object({
  id: z.string(),
  kind: z.literal('image'),
  fileName: z.string(),
  mimeType: z.string(),
  dataUrl: z.string().min(1),
  caption: z.string().optional(),
  displayWidth: z.number().positive().optional(),
  createdAt: z.string(),
});

export const codeAttachmentSchema = z.object({
  id: z.string(),
  kind: z.literal('code'),
  language: z.enum([
    'sql',
    'javascript',
    'typescript',
    'json',
    'xml',
    'html',
    'css',
    'bash',
    'powershell',
  ]),
  content: z.string(),
  createdAt: z.string(),
});

export const logAttachmentSchema = z.object({
  id: z.string(),
  kind: z.literal('log'),
  content: z.string(),
  createdAt: z.string(),
});

export const testAttachmentSchema = z.discriminatedUnion('kind', [
  imageAttachmentSchema,
  codeAttachmentSchema,
  logAttachmentSchema,
]);

export const testCaseEditorSchema = z.object({
  number: z.string().min(1, 'Укажите номер теста'),
  title: z.string(),
  section: z.string(),
  module: z.string(),
  author: z.string(),
  developer: z.string(),
  businessAnalyst: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['draft', 'ready', 'in_progress', 'passed', 'failed', 'blocked']),
  goal: richTextSchema.refine((value) => value.plainText.trim().length > 0, {
    message: 'Заполните цель теста',
  }),
  goalImages: z.array(testAttachmentSchema),
  preconditions: z.string(),
  steps: richTextSchema,
  verificationResult: richTextSchema,
  verificationAttachments: z.array(testAttachmentSchema),
  testOutcome: z.enum(['passed', 'failed']).nullable(),
  includeInRegression: z.boolean(),
  includeInTaskRegression: z.boolean(),
});

export type TestCaseEditorFormValues = z.infer<typeof testCaseEditorSchema>;
