import { pmiTemplate } from '@/templates/pmi/definition';
import { psiTemplate } from '@/templates/psi/definition';
import type { CaseFieldId, DocumentTemplate, TaskFieldId, TemplateId } from '@/templates/types';
import { TEMPLATE_IDS } from '@/templates/types';

const TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  pmi: pmiTemplate,
  psi: psiTemplate,
};

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/** Saved tasks without a template stay on the current methodology export. */
export function resolveTemplateId(value: unknown): TemplateId {
  return isTemplateId(value) ? value : 'pmi';
}

export function getTemplate(id: TemplateId): DocumentTemplate {
  return TEMPLATES[id];
}

export function listTemplates(): DocumentTemplate[] {
  return TEMPLATE_IDS.map((id) => TEMPLATES[id]);
}

export function templateShowsTaskField(id: TemplateId, field: TaskFieldId): boolean {
  return getTemplate(id).taskFields.includes(field);
}

export function templateShowsCaseField(id: TemplateId, field: CaseFieldId): boolean {
  return getTemplate(id).caseFields.includes(field);
}
