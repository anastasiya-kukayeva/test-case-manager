import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { confirmAction } from '@/application/ui/confirmAction';
import {
  DIRECTORY_ROLE_LABELS,
  type DirectoryApplication,
  type DirectoryEnvironment,
  type DirectoryModule,
  type DirectoryPerson,
  type DirectoryRole,
} from '@/domain/types';
import { projectFileService } from '@/infrastructure/project/projectFileService';
import { appStorageService } from '@/infrastructure/storage/appStorageService';
import { useAppStore } from '@/stores/useAppStore';
import { useProjectStore } from '@/stores/useProjectStore';

type DirectoryStoreState = {
  people: DirectoryPerson[];
  applications: DirectoryApplication[];
  modules: DirectoryModule[];
  environments: DirectoryEnvironment[];
  isLoaded: boolean;
  load: () => Promise<void>;
  peopleByRole: (role: DirectoryRole) => DirectoryPerson[];
  addPerson: (role: DirectoryRole, name: string) => Promise<DirectoryPerson | null>;
  updatePerson: (id: string, name: string) => Promise<boolean>;
  removePerson: (id: string) => Promise<boolean>;
  addApplication: (name: string) => Promise<DirectoryApplication | null>;
  updateApplication: (id: string, name: string) => Promise<boolean>;
  removeApplication: (id: string) => Promise<boolean>;
  addModule: (name: string) => Promise<DirectoryModule | null>;
  updateModule: (id: string, name: string) => Promise<boolean>;
  removeModule: (id: string) => Promise<boolean>;
  addEnvironment: (name: string) => Promise<DirectoryEnvironment | null>;
  updateEnvironment: (id: string, name: string) => Promise<boolean>;
  removeEnvironment: (id: string) => Promise<boolean>;
  setDefaultAuthor: (id: string) => Promise<boolean>;
  setDefaultEnvironment: (id: string) => Promise<boolean>;
};

async function applicationNamesFromTasks(): Promise<string[]> {
  const names = new Set<string>();
  const current = useProjectStore.getState().current;
  const currentName = current?.document.meta.application?.trim();
  if (currentName) {
    names.add(currentName);
  }

  if (!projectFileService.isAvailable()) {
    return [...names];
  }

  const seen = new Set<string>();
  if (current?.filePath) {
    seen.add(current.filePath);
  }

  for (const recent of useAppStore.getState().recentProjects) {
    if (!recent.filePath || recent.filePath.startsWith('__unsaved__') || seen.has(recent.filePath)) {
      continue;
    }
    seen.add(recent.filePath);
    try {
      const { document } = await projectFileService.openFromPath(recent.filePath);
      const name = document.meta.application?.trim();
      if (name) {
        names.add(name);
      }
    } catch {
      // Skip unreadable task files.
    }
  }

  return [...names];
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function sortPeople(people: DirectoryPerson[]): DirectoryPerson[] {
  return [...people].sort((a, b) => {
    const byRole = a.role.localeCompare(b.role);
    if (byRole !== 0) {
      return byRole;
    }
    return a.name.localeCompare(b.name, 'ru');
  });
}

function sortApplications(applications: DirectoryApplication[]): DirectoryApplication[] {
  return [...applications].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export const useDirectoryStore = create<DirectoryStoreState>((set, get) => ({
  people: [],
  applications: [],
  modules: [],
  environments: [],
  isLoaded: false,

  load: async () => {
    try {
      if (!appStorageService.isAvailable()) {
        set({ people: [], applications: [], modules: [], environments: [], isLoaded: true });
        return;
      }
      const [people, storedApplications, modules, environments, seeded] = await Promise.all([
        appStorageService.getDirectoryPeople(),
        appStorageService.getDirectoryApplications(),
        appStorageService.getDirectoryModules(),
        appStorageService.getDirectoryEnvironments(),
        appStorageService.isDirectoryApplicationsSeeded(),
      ]);

      let applications = storedApplications;
      if (!seeded) {
        const known = new Set(applications.map((item) => item.name.toLocaleLowerCase('ru')));
        const extras = (await applicationNamesFromTasks()).filter(
          (name) => !known.has(name.toLocaleLowerCase('ru')),
        );
        if (extras.length > 0) {
          applications = sortApplications([
            ...applications,
            ...extras.map((name) => ({
              id: nanoid(),
              name,
              createdAt: new Date().toISOString(),
            })),
          ]);
          await appStorageService.saveDirectoryApplications(applications);
        }
        await appStorageService.markDirectoryApplicationsSeeded();
      }

      set({ people, applications, modules, environments, isLoaded: true });
    } catch (error) {
      notifyError(error, { title: 'Не удалось загрузить справочник' });
      set({ people: [], applications: [], modules: [], environments: [], isLoaded: true });
    }
  },

  peopleByRole: (role) => get().people.filter((item) => item.role === role),

  addPerson: async (role, name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите ФИО или название');
      }

      const exists = get().people.some(
        (item) =>
          item.role === role &&
          item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError(
          'VALIDATION',
          `«${normalized}» уже есть в категории «${DIRECTORY_ROLE_LABELS[role]}»`,
        );
      }

      const person: DirectoryPerson = {
        id: nanoid(),
        name: normalized,
        role,
        createdAt: new Date().toISOString(),
      };
      const next = sortPeople([...get().people, person]);
      set({ people: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryPeople(next);
      }

      notifySuccess(`Добавлено в «${DIRECTORY_ROLE_LABELS[role]}»: ${normalized}`);
      return person;
    } catch (error) {
      notifyError(error, { title: 'Не удалось добавить' });
      return null;
    }
  },

  updatePerson: async (id, name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите ФИО или название');
      }

      const current = get().people.find((item) => item.id === id);
      if (!current) {
        throw new AppError('NOT_FOUND', 'Запись не найдена');
      }

      const exists = get().people.some(
        (item) =>
          item.id !== id &&
          item.role === current.role &&
          item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError(
          'VALIDATION',
          `«${normalized}» уже есть в категории «${DIRECTORY_ROLE_LABELS[current.role]}»`,
        );
      }

      const next = sortPeople(
        get().people.map((item) => (item.id === id ? { ...item, name: normalized } : item)),
      );
      set({ people: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryPeople(next);
      }

      notifySuccess('Запись обновлена');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить' });
      return false;
    }
  },

  removePerson: async (id) => {
    const person = get().people.find((item) => item.id === id);
    if (!person) {
      return false;
    }

    const confirmed = await confirmAction({
      title: 'Удалить из справочника?',
      message: `«${person.name}» будет удалён(а) из категории «${DIRECTORY_ROLE_LABELS[person.role]}». В уже сохранённых тест-кейсах значение останется.`,
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return false;
    }

    try {
      const next = get().people.filter((item) => item.id !== id);
      set({ people: next });
      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryPeople(next);
      }
      notifySuccess('Удалено из справочника');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось удалить' });
      return false;
    }
  },

  addApplication: async (name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите название приложения');
      }

      const exists = get().applications.some(
        (item) => item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError('VALIDATION', `Приложение «${normalized}» уже есть в списке`);
      }

      const application: DirectoryApplication = {
        id: nanoid(),
        name: normalized,
        createdAt: new Date().toISOString(),
      };
      const next = sortApplications([...get().applications, application]);
      set({ applications: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryApplications(next);
      }

      notifySuccess(`Добавлено приложение: ${normalized}`);
      return application;
    } catch (error) {
      notifyError(error, { title: 'Не удалось добавить приложение' });
      return null;
    }
  },

  updateApplication: async (id, name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите название приложения');
      }

      const current = get().applications.find((item) => item.id === id);
      if (!current) {
        throw new AppError('NOT_FOUND', 'Приложение не найдено');
      }

      const exists = get().applications.some(
        (item) =>
          item.id !== id &&
          item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError('VALIDATION', `Приложение «${normalized}» уже есть в списке`);
      }

      const next = sortApplications(
        get().applications.map((item) =>
          item.id === id ? { ...item, name: normalized } : item,
        ),
      );
      set({ applications: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryApplications(next);
      }

      notifySuccess('Приложение обновлено');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить приложение' });
      return false;
    }
  },

  removeApplication: async (id) => {
    const application = get().applications.find((item) => item.id === id);
    if (!application) {
      return false;
    }

    const confirmed = await confirmAction({
      title: 'Удалить приложение?',
      message: `«${application.name}» будет удалено из списка приложений. В уже сохранённых задачах значение останется.`,
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return false;
    }

    try {
      const next = get().applications.filter((item) => item.id !== id);
      set({ applications: next });
      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryApplications(next);
      }
      notifySuccess('Приложение удалено');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось удалить приложение' });
      return false;
    }
  },

  addModule: async (name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите название модуля');
      }

      const exists = get().modules.some(
        (item) => item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError('VALIDATION', `Модуль «${normalized}» уже есть в списке`);
      }

      const moduleItem: DirectoryModule = {
        id: nanoid(),
        name: normalized,
        createdAt: new Date().toISOString(),
      };
      const next = sortApplications([...get().modules, moduleItem]);
      set({ modules: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryModules(next);
      }

      notifySuccess(`Добавлен модуль: ${normalized}`);
      return moduleItem;
    } catch (error) {
      notifyError(error, { title: 'Не удалось добавить модуль' });
      return null;
    }
  },

  updateModule: async (id, name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите название модуля');
      }

      const current = get().modules.find((item) => item.id === id);
      if (!current) {
        throw new AppError('NOT_FOUND', 'Модуль не найден');
      }

      const exists = get().modules.some(
        (item) =>
          item.id !== id &&
          item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError('VALIDATION', `Модуль «${normalized}» уже есть в списке`);
      }

      const next = sortApplications(
        get().modules.map((item) => (item.id === id ? { ...item, name: normalized } : item)),
      );
      set({ modules: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryModules(next);
      }

      notifySuccess('Модуль обновлён');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить модуль' });
      return false;
    }
  },

  removeModule: async (id) => {
    const moduleItem = get().modules.find((item) => item.id === id);
    if (!moduleItem) {
      return false;
    }

    const confirmed = await confirmAction({
      title: 'Удалить модуль?',
      message: `«${moduleItem.name}» будет удалён из справочника. В уже сохранённых тест-кейсах значение останется.`,
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return false;
    }

    try {
      const next = get().modules.filter((item) => item.id !== id);
      set({ modules: next });
      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryModules(next);
      }
      notifySuccess('Модуль удалён');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось удалить модуль' });
      return false;
    }
  },

  addEnvironment: async (name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите название среды');
      }

      const exists = get().environments.some(
        (item) => item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError('VALIDATION', `Среда «${normalized}» уже есть в списке`);
      }

      const environment: DirectoryEnvironment = {
        id: nanoid(),
        name: normalized,
        createdAt: new Date().toISOString(),
      };
      const next = sortApplications([...get().environments, environment]);
      set({ environments: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryEnvironments(next);
      }

      notifySuccess(`Добавлена среда: ${normalized}`);
      return environment;
    } catch (error) {
      notifyError(error, { title: 'Не удалось добавить среду' });
      return null;
    }
  },

  updateEnvironment: async (id, name) => {
    try {
      const normalized = normalizeName(name);
      if (!normalized) {
        throw new AppError('VALIDATION', 'Укажите название среды');
      }

      const current = get().environments.find((item) => item.id === id);
      if (!current) {
        throw new AppError('NOT_FOUND', 'Среда не найдена');
      }

      const exists = get().environments.some(
        (item) =>
          item.id !== id &&
          item.name.toLocaleLowerCase('ru') === normalized.toLocaleLowerCase('ru'),
      );
      if (exists) {
        throw new AppError('VALIDATION', `Среда «${normalized}» уже есть в списке`);
      }

      const next = sortApplications(
        get().environments.map((item) => (item.id === id ? { ...item, name: normalized } : item)),
      );
      set({ environments: next });

      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryEnvironments(next);
      }

      notifySuccess('Среда обновлена');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось обновить среду' });
      return false;
    }
  },

  removeEnvironment: async (id) => {
    const environment = get().environments.find((item) => item.id === id);
    if (!environment) {
      return false;
    }

    const confirmed = await confirmAction({
      title: 'Удалить среду?',
      message: `«${environment.name}» будет удалена из справочника.`,
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      confirmColor: 'red',
    });

    if (!confirmed) {
      return false;
    }

    try {
      const next = get().environments.filter((item) => item.id !== id);
      set({ environments: next });
      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryEnvironments(next);
      }
      notifySuccess('Среда удалена');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось удалить среду' });
      return false;
    }
  },

  setDefaultAuthor: async (id) => {
    const person = get().people.find((item) => item.id === id && item.role === 'author');
    if (!person) {
      return false;
    }
    const nextDefault = !person.isDefault;
    const next = get().people.map((item) =>
      item.role === 'author' ? { ...item, isDefault: nextDefault && item.id === id } : item,
    );
    set({ people: next });
    try {
      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryPeople(next);
      }
      notifySuccess(nextDefault ? `Автор по умолчанию: ${person.name}` : 'Автор по умолчанию снят');
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось сохранить автора по умолчанию' });
      return false;
    }
  },

  setDefaultEnvironment: async (id) => {
    const environment = get().environments.find((item) => item.id === id);
    if (!environment) {
      return false;
    }
    const nextDefault = !environment.isDefault;
    const next = get().environments.map((item) => ({
      ...item,
      isDefault: nextDefault && item.id === id,
    }));
    set({ environments: next });
    try {
      if (appStorageService.isAvailable()) {
        await appStorageService.saveDirectoryEnvironments(next);
      }
      notifySuccess(
        nextDefault ? `Среда по умолчанию: ${environment.name}` : 'Среда по умолчанию снята',
      );
      return true;
    } catch (error) {
      notifyError(error, { title: 'Не удалось сохранить среду по умолчанию' });
      return false;
    }
  },
}));
