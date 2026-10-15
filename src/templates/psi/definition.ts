import type { DocumentTemplate } from '@/templates/types';

/** Acceptance-test table. Task narrative sections are not printed. */
export const psiTemplate: DocumentTemplate = {
  id: 'psi',
  title: 'ПСИ',
  taskFields: ['name', 'shortName', 'releaseNumber', 'application', 'module'],
  caseFields: ['number', 'title', 'psiSteps', 'psiResults'],
};
