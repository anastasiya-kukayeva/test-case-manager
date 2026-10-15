export const TEMPLATE_IDS = ['pmi', 'psi'] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TaskFieldId =
  | 'name'
  | 'shortName'
  | 'releaseNumber'
  | 'application'
  | 'module'
  | 'testObject'
  | 'testGoal'
  | 'generalProvisions'
  | 'functionalRequirements'
  | 'risksAndLimitations';

export type CaseFieldId =
  | 'number'
  | 'title'
  | 'goal'
  | 'preconditions'
  | 'steps'
  | 'psiSteps'
  | 'verification'
  | 'psiResults'
  | 'outcome'
  | 'regression';

export type DocumentTemplate = {
  id: TemplateId;
  /** Label shown in the interface. */
  title: string;
  taskFields: readonly TaskFieldId[];
  caseFields: readonly CaseFieldId[];
};
