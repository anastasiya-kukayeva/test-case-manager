import type { TaskDocument, TaskMeta, TestCase } from '@/domain/types';
import { TC_TASK_FORMAT_VERSION } from '@/domain/types/task';
import { pool } from './db.js';

type TaskRow = {
  id: string;
  name: string;
  short_name: string;
  release_number: string;
  description: string;
  author: string;
  test_object: string;
  test_object_links: TaskMeta['testObjectLinks'];
  application: string;
  module: string;
  test_goal: TaskMeta['testGoal'];
  general_provisions: string;
  functional_requirements: TaskMeta['functionalRequirements'];
  risks_and_limitations: TaskMeta['risksAndLimitations'];
  parent_task_id: string | null;
  created_at: Date;
  updated_at: Date;
};

type CaseRow = {
  id: string;
  task_id: string;
  number: string;
  title: string;
  section: string;
  module: string;
  author: string;
  developer: string;
  business_analyst: string;
  priority: TestCase['priority'];
  status: TestCase['status'];
  goal: TestCase['goal'];
  goal_images: TestCase['goalImages'];
  preconditions: string;
  steps: TestCase['steps'];
  verification_result: TestCase['verificationResult'];
  verification_attachments: TestCase['verificationAttachments'];
  test_outcome: TestCase['testOutcome'];
  include_in_regression: boolean;
  include_in_task_regression: boolean;
  created_at: Date;
  updated_at: Date;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function metaFromRow(row: TaskRow): TaskMeta {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    releaseNumber: row.release_number,
    description: row.description,
    author: row.author,
    testObject: row.test_object,
    testObjectLinks: row.test_object_links ?? [],
    application: row.application,
    module: row.module,
    testGoal: row.test_goal,
    generalProvisions: row.general_provisions,
    functionalRequirements: row.functional_requirements,
    risksAndLimitations: row.risks_and_limitations,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    parentTaskId: row.parent_task_id,
  };
}

function caseFromRow(row: CaseRow): TestCase {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    section: row.section,
    module: row.module,
    author: row.author,
    developer: row.developer,
    businessAnalyst: row.business_analyst,
    priority: row.priority,
    status: row.status,
    goal: row.goal,
    goalImages: row.goal_images ?? [],
    preconditions: row.preconditions,
    steps: row.steps,
    verificationResult: row.verification_result,
    verificationAttachments: row.verification_attachments ?? [],
    testOutcome: row.test_outcome,
    includeInRegression: row.include_in_regression,
    includeInTaskRegression: row.include_in_task_regression,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export async function listTaskSummaries() {
  const result = await pool.query<Pick<TaskRow, 'id' | 'name' | 'short_name' | 'parent_task_id' | 'updated_at' | 'application' | 'module'>>(
    'SELECT id, name, short_name, parent_task_id, updated_at, application, module FROM tasks ORDER BY name',
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    parentTaskId: row.parent_task_id,
    updatedAt: iso(row.updated_at),
    application: row.application,
    module: row.module,
    filePath: `web:${row.id}`,
  }));
}

export async function loadDocument(taskId: string): Promise<TaskDocument | null> {
  const task = await pool.query<TaskRow>('SELECT * FROM tasks WHERE id = $1', [taskId]);
  const row = task.rows[0];
  if (!row) {
    return null;
  }
  const cases = await pool.query<CaseRow>(
    'SELECT * FROM test_cases WHERE task_id = $1 ORDER BY number, created_at',
    [taskId],
  );
  return {
    formatVersion: TC_TASK_FORMAT_VERSION,
    meta: metaFromRow(row),
    testCases: cases.rows.map(caseFromRow),
  };
}

export class ConflictError extends Error {
  constructor() {
    super('CONFLICT');
  }
}

async function replaceCases(taskId: string, cases: TestCase[]): Promise<void> {
  await pool.query('DELETE FROM test_cases WHERE task_id = $1', [taskId]);
  for (const item of cases) {
    await pool.query(
      `INSERT INTO test_cases (
        id, task_id, number, title, section, module, author, developer, business_analyst,
        priority, status, goal, goal_images, preconditions, steps, verification_result,
        verification_attachments, test_outcome, include_in_regression, include_in_task_regression,
        created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15::jsonb,$16::jsonb,$17::jsonb,$18,$19,$20,$21,$22
      )`,
      [
        item.id,
        taskId,
        item.number,
        item.title,
        item.section,
        item.module,
        item.author,
        item.developer,
        item.businessAnalyst,
        item.priority,
        item.status,
        JSON.stringify(item.goal),
        JSON.stringify(item.goalImages ?? []),
        item.preconditions,
        JSON.stringify(item.steps),
        JSON.stringify(item.verificationResult),
        JSON.stringify(item.verificationAttachments ?? []),
        item.testOutcome,
        item.includeInRegression,
        item.includeInTaskRegression,
        item.createdAt,
        item.updatedAt,
      ],
    );
  }
}

export async function saveDocument(
  document: TaskDocument,
  userId: string,
  expectedUpdatedAt?: string,
): Promise<TaskDocument> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ updated_at: Date }>(
      'SELECT updated_at FROM tasks WHERE id = $1 FOR UPDATE',
      [document.meta.id],
    );
    if (current.rowCount && expectedUpdatedAt) {
      const stored = iso(current.rows[0].updated_at);
      if (stored !== expectedUpdatedAt) {
        throw new ConflictError();
      }
    }
    const updatedAt = new Date().toISOString();
    const meta = { ...document.meta, updatedAt };
    if (!current.rowCount) {
      await client.query(
        `INSERT INTO tasks (
          id, name, short_name, release_number, description, author, test_object, test_object_links,
          application, module, test_goal, general_provisions, functional_requirements, risks_and_limitations,
          parent_task_id, created_at, updated_at, updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11::jsonb,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18
        )`,
        [
          meta.id, meta.name, meta.shortName, meta.releaseNumber, meta.description, meta.author,
          meta.testObject, JSON.stringify(meta.testObjectLinks ?? []), meta.application, meta.module,
          JSON.stringify(meta.testGoal), meta.generalProvisions, JSON.stringify(meta.functionalRequirements),
          JSON.stringify(meta.risksAndLimitations), meta.parentTaskId || null, meta.createdAt, updatedAt, userId,
        ],
      );
    } else {
      await client.query(
        `UPDATE tasks SET
          name=$2, short_name=$3, release_number=$4, description=$5, author=$6, test_object=$7,
          test_object_links=$8::jsonb, application=$9, module=$10, test_goal=$11::jsonb,
          general_provisions=$12, functional_requirements=$13::jsonb, risks_and_limitations=$14::jsonb,
          parent_task_id=$15, updated_at=$16, updated_by=$17
         WHERE id=$1`,
        [
          meta.id, meta.name, meta.shortName, meta.releaseNumber, meta.description, meta.author,
          meta.testObject, JSON.stringify(meta.testObjectLinks ?? []), meta.application, meta.module,
          JSON.stringify(meta.testGoal), meta.generalProvisions, JSON.stringify(meta.functionalRequirements),
          JSON.stringify(meta.risksAndLimitations), meta.parentTaskId || null, updatedAt, userId,
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await replaceCases(document.meta.id, document.testCases);
  const saved = await loadDocument(document.meta.id);
  if (!saved) {
    throw new Error('Задача не сохранилась');
  }
  return saved;
}

export async function deleteTask(taskId: string): Promise<void> {
  await pool.query('UPDATE tasks SET parent_task_id = NULL WHERE parent_task_id = $1', [taskId]);
  await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
}
