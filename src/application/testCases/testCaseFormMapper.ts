import type { TestCase } from '@/domain/types';
import type { TestCaseEditorFormValues } from '@/domain/schemas/testCaseSchema';
import { createEmptyRichText, normalizeStepsContent } from '@/domain/factories/createEntities';
import {
  isCodeAttachment,
  isImageAttachment,
  isLogAttachment,
} from '@/domain/types/attachment';
import type { RichTextContent, TestAttachment } from '@/domain/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtml(value);
}

function htmlFromContent(html: string): string {
  const temporary = document.createElement('div');
  temporary.innerHTML = html;
  return temporary.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
}

/**
 * Move legacy separate screenshot / code / log attachments into verification rich text.
 */
export function inlineVerificationAttachments(
  result: RichTextContent,
  attachments: TestAttachment[],
): RichTextContent {
  if (!attachments.length) {
    return result;
  }

  let html = result.html || '';
  const chunks: string[] = [];

  for (const image of attachments.filter(isImageAttachment)) {
    if (html.includes(image.dataUrl)) {
      continue;
    }
    const alt = escapeHtmlAttr(image.caption || image.fileName || 'screenshot');
    chunks.push(`<p><img src="${image.dataUrl}" alt="${alt}" class="tcm-rte-image"></p>`);
  }

  for (const block of attachments.filter(isCodeAttachment)) {
    const content = block.content || '';
    if (!content.trim()) {
      continue;
    }
    if (html.includes(content)) {
      continue;
    }
    const language = block.language || 'text';
    chunks.push(
      `<pre class="tcm-code-block"><code class="language-${escapeHtmlAttr(language)}">${escapeHtml(content)}</code></pre>`,
    );
  }

  for (const block of attachments.filter(isLogAttachment)) {
    const content = block.content || '';
    if (!content.trim()) {
      continue;
    }
    if (html.includes(content)) {
      continue;
    }
    chunks.push(
      `<pre class="tcm-log-block" data-type="log"><code>${escapeHtml(content)}</code></pre>`,
    );
  }

  if (chunks.length === 0) {
    return result;
  }

  const nextHtml = `${html}${chunks.join('')}`;
  return {
    html: nextHtml,
    plainText: htmlFromContent(nextHtml) || result.plainText,
  };
}

/** @deprecated use inlineVerificationAttachments */
export function inlineVerificationImages(
  result: RichTextContent,
  attachments: TestAttachment[],
): { result: RichTextContent; attachments: TestAttachment[] } {
  return {
    result: inlineVerificationAttachments(result, attachments),
    attachments: [],
  };
}

export function testCaseToFormValues(testCase: TestCase): TestCaseEditorFormValues {
  return {
    number: testCase.number,
    title: testCase.title,
    section: testCase.section,
    module: testCase.module,
    author: testCase.author ?? '',
    developer: testCase.developer ?? '',
    businessAnalyst: testCase.businessAnalyst ?? '',
    priority: testCase.priority,
    status: testCase.status,
    goal: testCase.goal ?? createEmptyRichText(),
    goalImages: testCase.goalImages ?? [],
    preconditions: testCase.preconditions ?? '',
    steps: normalizeStepsContent(testCase.steps),
    verificationResult: inlineVerificationAttachments(
      testCase.verificationResult ?? createEmptyRichText(),
      testCase.verificationAttachments ?? [],
    ),
    verificationAttachments: [],
    testOutcome: testCase.testOutcome,
    includeInRegression: Boolean(testCase.includeInRegression),
    includeInTaskRegression: Boolean(testCase.includeInTaskRegression),
  };
}

export function formValuesToTestCasePatch(
  values: TestCaseEditorFormValues,
): Partial<TestCase> {
  return {
    number: values.number.trim(),
    title: values.title.trim(),
    section: values.section.trim(),
    module: values.module.trim(),
    author: values.author.trim(),
    developer: values.developer.trim(),
    businessAnalyst: values.businessAnalyst.trim(),
    priority: values.priority,
    status: values.status,
    goal: values.goal,
    goalImages: values.goalImages,
    preconditions: values.preconditions,
    steps: values.steps,
    verificationResult: values.verificationResult,
    // Screenshots, code and logs live in verificationResult HTML.
    verificationAttachments: [],
    testOutcome: values.testOutcome,
    includeInRegression: values.includeInRegression,
    includeInTaskRegression: values.includeInTaskRegression,
    updatedAt: new Date().toISOString(),
  };
}
