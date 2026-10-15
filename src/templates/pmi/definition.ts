import type { DocumentTemplate } from '@/templates/types';

/** Current methodology export. */
export const pmiTemplate: DocumentTemplate = {
  id: 'pmi',
  title: 'ПМИ (Pega)',
  taskFields: [
    'name',
    'shortName',
    'releaseNumber',
    'application',
    'module',
    'testObject',
    'testGoal',
    'generalProvisions',
    'functionalRequirements',
    'risksAndLimitations',
  ],
  caseFields: [
    'number',
    'goal',
    'preconditions',
    'steps',
    'verification',
    'outcome',
    'regression',
  ],
};
