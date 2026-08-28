import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { AppError } from '@/application/errors/AppError';
import { notifyError, notifySuccess } from '@/application/errors/errorHandler';
import { confirmAction } from '@/application/ui/confirmAction';
import {
  DIRECTORY_ROLE_LABELS,
  type DirectoryApplication,
  type DirectoryPerson,
  type DirectoryRole,
} from '@/domain/types';
import { appStorageService } from '@/infrastructure/storage/appStorageService';

type DirectoryStoreState = {
  people: DirectoryPerson[];
  applications: DirectoryApplication[];
  isLoaded: boolean;
  load: () => Promise<void>;
  peopleByRole: (role: DirectoryRole) => DirectoryPerson[];
  addPerson: (role: DirectoryRole, name: string) => Promise<DirectoryPerson | null>;
  updatePerson: (id: string, name: string) => Promise<boolean>;
  removePerson: (id: string) => Promise<boolean>;
  addApplication: (name: string) => Promise<DirectoryApplication | null>;
  updateApplication: (id: string, name: string) => Promise<boolean>;
  removeApplication: (id: string) => Promise<boolean>;
};

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
  isLoaded: false,

  load: async () => {
    try {
      if (!appStorageService.isAvailable()) {
        set({ people: [], applications: [], isLoaded: true });
        return;
      }
      const [people, applications] = await Promise.all([
        appStorageService.getDirectoryPeople(),
        appStorageService.getDirectoryApplications(),
      ]);
      set({ people, applications, isLoaded: true });
    } catch (error) {
      notifyError(error, { title: 'Не удалось загрузить справочник' });
      set({ people: [], applications: [], isLoaded: true });
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
}));
