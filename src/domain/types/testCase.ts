import type { TestAttachment } from '@/domain/types/attachment';
import type {
  TestCasePriority,
  TestCaseStatus,
  TestResultOutcome,
} from '@/domain/types/enums';

export type RichTextContent = {
  html: string;
  plainText: string;
};

export type TestCase = {
  id: string;
  number: string;
  title: string;
  section: string;
  module: string;
  author: string;
  developer: string;
  businessAnalyst: string;
  priority: TestCasePriority;
  status: TestCaseStatus;
  goal: RichTextContent;
  goalImages: TestAttachment[];
  preconditions: string;
  /** Free-form steps text; supports numbered lists via rich text. */
  steps: RichTextContent;
  verificationResult: RichTextContent;
  verificationAttachments: TestAttachment[];
  testOutcome: TestResultOutcome;
  /** Marker for a future regression suite. Not used in export yet. */
  includeInRegression: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TestCaseSummary = Pick<
  TestCase,
  | 'id'
  | 'number'
  | 'title'
  | 'section'
  | 'module'
  | 'author'
  | 'developer'
  | 'businessAnalyst'
  | 'priority'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
>;
