import { z } from 'zod';
import { isRichContentFilled } from '@/templates/shared/richContent';
import type { TemplateId } from '@/templates/types';

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

export const psiStepSchema = z.object({
  id: z.string(),
  content: richTextSchema,
});

export const psiResultSchema = z.object({
  id: z.string(),
  expected: richTextSchema,
  actual: richTextSchema,
});

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
  goal: richTextSchema,
  goalImages: z.array(testAttachmentSchema),
  preconditions: z.string(),
  steps: richTextSchema,
  psiSteps: z.array(psiStepSchema),
  psiResults: z.array(psiResultSchema).superRefine((items, ctx) => {
    items.forEach((item, index) => {
      const expected = isRichContentFilled(item.expected);
      const actual = isRichContentFilled(item.actual);
      if (expected && !actual) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'actual'],
          message: 'Заполните фактический результат',
        });
      }
      if (actual && !expected) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'expected'],
          message: 'Заполните ожидаемый результат',
        });
      }
    });
  }),
  verificationResult: richTextSchema,
  verificationAttachments: z.array(testAttachmentSchema),
  testOutcome: z.enum(['passed', 'failed']).nullable(),
  includeInRegression: z.boolean(),
  includeInTaskRegression: z.boolean(),
});

export function editorSchemaForTemplate(templateId: TemplateId) {
  if (templateId === 'psi') {
    return testCaseEditorSchema.superRefine((value, ctx) => {
      if (!value.title.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['title'],
          message: 'Укажите наименование тест-кейса',
        });
      }
    });
  }

  return testCaseEditorSchema.superRefine((value, ctx) => {
    if (!value.goal.plainText.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['goal'],
        message: 'Заполните цель теста',
      });
    }
  });
}

export type TestCaseEditorFormValues = z.infer<typeof testCaseEditorSchema>;
