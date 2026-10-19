import { describe, expect, it } from 'vitest';
import {
  testCaseEditorSchema,
  type TestCaseEditorFormValues,
} from '@/domain/schemas/testCaseSchema';

function validForm(partial?: Partial<TestCaseEditorFormValues>): TestCaseEditorFormValues {
  return {
    number: '1',
    title: 'Оплата',
    section: '',
    module: '',
    author: '',
    developer: '',
    businessAnalyst: '',
    priority: 'high',
    status: 'ready',
    goal: { html: '<p>Цель</p>', plainText: 'Цель' },
    goalImages: [],
    preconditions: '',
    steps: { html: '', plainText: '' },
    verificationResult: { html: '', plainText: '' },
    verificationAttachments: [],
    testOutcome: null,
    includeInRegression: false,
    includeInTaskRegression: true,
    ...partial,
  };
}

describe('testCaseEditorSchema', () => {
  it('accepts a filled editor form', () => {
    expect(testCaseEditorSchema.safeParse(validForm()).success).toBe(true);
  });

  it('requires a number and a non-blank goal', () => {
    expect(testCaseEditorSchema.safeParse(validForm({ number: '' })).success).toBe(false);
    expect(
      testCaseEditorSchema.safeParse(validForm({ goal: { html: '<p> </p>', plainText: '   ' } }))
        .success,
    ).toBe(false);
  });

  it('rejects unknown priority, status and outcome', () => {
    expect(
      testCaseEditorSchema.safeParse(validForm({ priority: 'urgent' as 'high' })).success,
    ).toBe(false);
    expect(testCaseEditorSchema.safeParse(validForm({ status: 'done' as 'ready' })).success).toBe(
      false,
    );
    expect(
      testCaseEditorSchema.safeParse(validForm({ testOutcome: 'maybe' as 'passed' })).success,
    ).toBe(false);
  });
});
