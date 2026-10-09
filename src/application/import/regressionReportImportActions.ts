import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { projectActions } from '@/application/project/projectActions';
import type { RegressionMode } from '@/application/regression/loadRegressionGroups';
import { createEmptyTestCase } from '@/domain/factories/createEntities';
import type { TaskDocument, TestCase } from '@/domain/types';
import type { ParsedRegressionReportCase } from '@/infrastructure/import/parseRegressionReportHtml';
import { importRegressionReportFromDocxBase64 } from '@/infrastructure/import/regressionReportImportService';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

export type RegressionImportTaskRef = {
  taskId: string;
  taskShortLabel: string;
  taskFilePath: string | null;
  application: string;
  module: string;
};

function requireImportApi() {
  const api = window.electronAPI;
  if (!api?.dialog?.openFile || !api.file?.readBinary) {
    throw new AppError(
      'IPC_UNAVAILABLE',
      'Импорт Word доступен только в Electron. Запустите приложение через npm run dev.',
    );
  }
  return api;
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase('ru') === right.trim().toLocaleLowerCase('ru');
}

/** Short task names from «Регрессионный отчет - {названия} за {месяц год}.docx». */
export function shortNamesFromReportFile(filePath: string): string[] {
  const base = (filePath.split(/[/\\]/).pop() ?? '').replace(/\.docx$/i, '');
  const match = base.match(/^Регрессионный отчет\s*[-:]\s*(.+?)\s+за\s+\S+/i);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function chooseTask(
  row: ParsedRegressionReportCase,
  tasks: RegressionImportTaskRef[],
  fileShortNames: string[],
): RegressionImportTaskRef | null {
  if (tasks.length === 0) {
    return null;
  }
  if (tasks.length === 1) {
    return tasks[0] ?? null;
  }

  let pool = tasks;
  if (row.applicationName) {
    const byApplication = pool.filter((task) => sameName(task.application, row.applicationName));
    if (byApplication.length === 1) {
      return byApplication[0] ?? null;
    }
    if (byApplication.length > 1) {
      pool = byApplication;
    }
  } else if (row.moduleName) {
    const byName = pool.filter(
      (task) => sameName(task.application, row.moduleName) || sameName(task.module, row.moduleName),
    );
    if (byName.length === 1) {
      return byName[0] ?? null;
    }
    if (byName.length > 1) {
      pool = byName;
    }
  }

  if (fileShortNames.length === 1) {
    const byShortName = pool.filter((task) => sameName(task.taskShortLabel, fileShortNames[0] ?? ''));
    if (byShortName.length === 1) {
      return byShortName[0] ?? null;
    }
  }

  return null;
}

function caseFromRow(row: ParsedRegressionReportCase, mode: RegressionMode): TestCase {
  return createEmptyTestCase({
    title: '',
    goal: {
      html: row.goalHtml,
      plainText: row.goalText,
    },
    includeInReport: true,
    includeInRegression: mode === 'suite',
    includeInTaskRegression: mode === 'task',
    regressionOnly: true,
    testOutcome: row.outcome,
  });
}

/** Append report rows without renumbering the task's own test cases. */
function appendRegressionOnlyCases(existing: TestCase[], created: TestCase[]): TestCase[] {
  let next = 0;
  for (const item of existing) {
    const parsed = Number.parseInt(String(item.number).trim(), 10);
    if (Number.isFinite(parsed) && parsed > next) {
      next = parsed;
    }
  }
  next += 1;
  const imported = created.map((item) => {
    const testCase = { ...item, number: String(next), regressionOnly: true };
    next += 1;
    return testCase;
  });
  return [...existing, ...imported];
}

function isCurrentTask(target: RegressionImportTaskRef): boolean {
  const current = useProjectStore.getState().current;
  if (!current) {
    return false;
  }
  return (
    current.document.meta.id === target.taskId ||
    Boolean(target.taskFilePath && current.filePath === target.taskFilePath)
  );
}

async function appendToTask(
  target: RegressionImportTaskRef,
  rows: ParsedRegressionReportCase[],
  mode: RegressionMode,
): Promise<void> {
  const created = rows.map((row) => caseFromRow(row, mode));
  if (isCurrentTask(target)) {
    const current = useProjectStore.getState().current;
    if (!current) {
      throw new AppError('NOT_FOUND', 'Задача больше не открыта');
    }
    useProjectStore.getState().updateDocument({
      ...current.document,
      testCases: appendRegressionOnlyCases(current.document.testCases, created),
    });
    const saved = await projectActions.save({ silent: true });
    if (!saved) {
      throw new AppError(
        'VALIDATION',
        'Тест-кейсы добавлены в открытую задачу. Сохраните файл задачи, чтобы они остались на диске.',
      );
    }
    return;
  }

  if (!target.taskFilePath || target.taskFilePath.startsWith('__unsaved__')) {
    throw new AppError(
      'VALIDATION',
      `Задача «${target.taskShortLabel}» не сохранена в файл. Откройте её и сохраните, затем повторите импорт.`,
    );
  }

  const opened = await projectFileService.openFromPath(target.taskFilePath);
  const document: TaskDocument = {
    ...opened.document,
    meta: {
      ...opened.document.meta,
      updatedAt: new Date().toISOString(),
    },
    testCases: appendRegressionOnlyCases(opened.document.testCases, created),
  };
  await projectFileService.saveToPath(target.taskFilePath, document);
}

export const regressionReportImportActions = {
  /**
   * Open a regression-report Word file and append a test case for each table row.
   * On a task screen every row goes into that task. On a module screen each row
   * goes to the task with the same application.
   */
  async importReport(args: {
    mode: RegressionMode;
    /** Task screen: the only task that receives every row. */
    singleTask: boolean;
    tasks: RegressionImportTaskRef[];
  }): Promise<boolean> {
    try {
      const api = requireImportApi();
      if (args.tasks.length === 0) {
        throw new AppError(
          'NOT_FOUND',
          'Не найдена задача, в которую можно добавить тест-кейсы. Откройте задачу в этом регрессе.',
        );
      }

      const defaultDir =
        useAppStore.getState().settings.storage.defaultProjectsDirectory ?? undefined;
      const filePath = await api.dialog.openFile({
        title: 'Импорт отчета из Word',
        defaultPath: defaultDir,
        filters: [
          { name: 'Документ Word', extensions: ['docx'] },
          { name: 'Все файлы', extensions: ['*'] },
        ],
        properties: ['openFile'],
      });
      if (!filePath) {
        return false;
      }

      const { base64 } = await api.file.readBinary(filePath);
      const parsed = await importRegressionReportFromDocxBase64(base64);
      if (parsed.length === 0) {
        throw new AppError(
          'VALIDATION',
          'В файле нет таблицы «Основные модули и статус проверки». Нужен отчёт, выгруженный из этой программы.',
        );
      }

      const fileShortNames = shortNamesFromReportFile(filePath);
      const buckets = new Map<string, { task: RegressionImportTaskRef; rows: ParsedRegressionReportCase[] }>();
      const unmatched: ParsedRegressionReportCase[] = [];
      for (const row of parsed) {
        const task = args.singleTask ? (args.tasks[0] ?? null) : chooseTask(row, args.tasks, fileShortNames);
        if (!task) {
          unmatched.push(row);
          continue;
        }
        const bucket = buckets.get(task.taskId);
        if (bucket) {
          bucket.rows.push(row);
        } else {
          buckets.set(task.taskId, { task, rows: [row] });
        }
      }

      if (unmatched.length > 0) {
        const sample = unmatched[0]?.goalText.slice(0, 80) ?? '';
        throw new AppError(
          'VALIDATION',
          `В этом модуле несколько задач, и по строке «${sample}» неясно, в какую её добавить. Откройте регресс нужной задачи и импортируйте отчёт там.`,
        );
      }

      const groups = [...buckets.values()];
      const currentGroup = groups.find((group) => isCurrentTask(group.task));
      const otherGroups = groups.filter((group) => group !== currentGroup);
      for (const group of otherGroups) {
        await appendToTask(group.task, group.rows, args.mode);
      }
      if (currentGroup) {
        await appendToTask(currentGroup.task, currentGroup.rows, args.mode);
      }

      const taskCount = groups.length;
      notifySuccess(
        taskCount > 1
          ? `Импортировано тест-кейсов: ${parsed.length}. Задач: ${taskCount}.`
          : `Импортировано тест-кейсов: ${parsed.length}`,
      );
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось импортировать отчет' });
      return false;
    }
  },
};
