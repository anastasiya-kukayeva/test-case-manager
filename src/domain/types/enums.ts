export type TestCaseStatus = 'draft' | 'ready' | 'in_progress' | 'passed' | 'failed' | 'blocked';

export type TestCasePriority = 'low' | 'medium' | 'high' | 'critical';

export type TestResultOutcome = 'passed' | 'failed' | null;

export type AttachmentKind = 'image' | 'code' | 'log';

export type CodeLanguage =
  | 'sql'
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'xml'
  | 'html'
  | 'css'
  | 'bash'
  | 'powershell';
