# Test Case Manager

Десктопное приложение для Windows для создания, редактирования, хранения и экспорта **методик испытаний (ПМИ)** и тест-кейсов в формате, близком к банковским шаблонам ПМИ.

**Путь проекта:** `C:\Users\ad.kukayeva\Work_PEGA\Projects\test-case-manager`

---

## 1. Назначение

Приложение позволяет:

- вести **задачи** (карточка ПМИ) с полями методики;
- внутри задачи создавать и редактировать **тест-кейсы**;
- сохранять данные в собственный файл `*.tctask` (читаются и старые `*.tcproj`);
- экспортировать итоговый документ **ПМИ** в **Word (DOCX)** по структуре образца:
  - заголовок «Методика испытаний в рамках задачи…»;
  - оглавление;
  - объект / цель / общие положения / требования;
  - сценарий испытаний (все тест-кейсы).

Иерархия данных:

```text
Задача (Task / ПМИ)
 └── Тест-кейсы (TestCase[])
      ├── цель, предусловия
      ├── шаги
      ├── результат проверки (текст, скриншоты, код, логи)
      └── итог: успешно / неуспешно
```

---

## 2. Возможности

### Задачи

- Создание задачи в отдельном окне с полями:
  - Название задачи
  - Объект испытаний (текст, ссылки)
  - Цель испытаний (rich text, списки)
  - Общие положения
  - Требования к функциональности (rich text, списки)
- Открытие / сохранение / «Сохранить как»
- Список недавних задач
- Автосохранение и восстановление после сбоя (recovery)
- Запоминание последней открытой задачи

### Тест-кейсы

- Список на TanStack Table: поиск, фильтры, даты, сортировка, колонки, пагинация
- CRUD, дублирование, массовое удаление
- Редактор: TipTap, шаги (DnD), скриншоты (Dropzone / Ctrl+V), код и логи
- Предпросмотр, автосохранение черновика в задачу

### Экспорт ПМИ

- Word (`docx`)
- В файл попадают **только заполненные** разделы задачи + все тест-кейсы
- Учитываются настройки: изображения / код / логи
- Кнопки экспорта: страница «Задачи», список тест-кейсов, редактор

### Настройки

- Тема Mantine (светлая / тёмная / системная)
- Папка задач по умолчанию
- Интервал автосохранения
- Параметры экспорта и горячие клавиши
- Сброс настроек, очистка недавних

---

## 3. Технологический стек

| Слой | Технологии |
| --- | --- |
| Desktop | Electron 36, electron-store, electron-builder |
| UI | React 19, TypeScript, Vite 6, Mantine 8, Tabler Icons, Framer Motion |
| Формы | React Hook Form, Zod, TipTap |
| Таблица | TanStack Table |
| DnD | dnd-kit |
| Экспорт | docx |
| Состояние | Zustand |
| Роутинг | React Router (HashRouter) |

---

## 4. Требования к окружению

- **ОС:** Windows 10/11
- **Node.js:** 20+ (проверено на 24.x)
- **npm:** 10+ (проверено на 11.x)
- Для полной сборки installer: права на запись в `release/`, при первом запуске electron-builder может скачать зависимости

Проверка версий:

```powershell
node -v
npm -v
```

---

## 5. Установка

```powershell
cd C:\Users\ad.kukayeva\Work_PEGA\Projects\test-case-manager
npm install
```

---

## 6. Запуск в режиме разработки

```powershell
npm run dev
```

Что происходит:

1. Vite поднимает renderer на `http://localhost:5173`
2. Плагин `vite-plugin-electron` собирает `main` / `preload` и запускает Electron
3. Открывается окно **Test Case Manager**

> Файловые операции (открытие/сохранение/экспорт) работают **только в Electron**. Чистый браузер без Electron не даёт полный функционал.

Остановка: `Ctrl+C` в терминале.

---

## 7. Сборка

### Только артефакты приложения (без installer)

```powershell
npm run build:vite
```

Результат:

- `dist/` — UI (renderer)
- `dist-electron/main.js` — main-процесс
- `dist-electron/preload.cjs` — preload

### Полная сборка + установщик Windows (NSIS)

```powershell
npm run build
```

Эквивалент: `tsc -b && vite build && electron-builder`.

Результат:

- те же `dist/` и `dist-electron/`
- installer в папке **`release/`** (NSIS `.exe`, productName: `Test Case Manager`)

Установка: запустить installer из `release/` и следовать мастеру.

---

## 8. Скрипты npm

| Команда | Описание |
| --- | --- |
| `npm run dev` | Разработка: Vite + Electron |
| `npm run build:vite` | Production-сборка без installer |
| `npm run build` | Production-сборка + electron-builder (NSIS) |
| `npm run preview` | Предпросмотр Vite (без полного Electron-сценария) |
| `npm run typecheck` | Проверка TypeScript |
| `npm run lint` | ESLint |
| `npm run format` | Prettier для `src` и `electron` |

---

## 9. Структура проекта

```text
test-case-manager/
├── electron/                 # Main-процесс Electron
│   ├── main.ts               # Окно приложения
│   ├── preload.ts            # contextBridge → window.electronAPI
│   ├── store.ts              # electron-store (настройки, recent)
│   └── ipc/                  # IPC: файлы, диалоги, store
├── src/
│   ├── application/          # Сценарии: задачи, тест-кейсы, экспорт, настройки
│   ├── components/           # UI: редактор, таблица, модалки, ui-kit
│   ├── domain/               # Типы, схемы Zod, фабрики сущностей
│   ├── hooks/                # Autosave, hotkeys, тема
│   ├── infrastructure/       # Файлы *.tctask, recovery, DOCX
│   ├── layouts/              # Header / Sidebar / Footer
│   ├── pages/                # Home, Tasks, TestCases, Editor, Settings
│   ├── providers/            # Bootstrap, ErrorBoundary, Mantine providers
│   ├── routes/               # HashRouter, пути
│   ├── stores/               # Zustand
│   └── theme/                # Тема Mantine
├── dist/                     # Сборка UI
├── dist-electron/            # Сборка Electron
├── release/                  # Installer (после npm run build)
├── package.json
└── vite.config.ts
```

Архитектурный принцип: **domain → application → infrastructure → UI**.

---

## 10. Формат файла задачи

- Основное расширение: **`*.tctask`**
- Совместимость: чтение **`*.tcproj`**
- Содержимое: JSON-конверт с `meta` (карточка задачи) и массивом `testCases`
- Recovery-снимок пишется при грязных изменениях для восстановления после аварийного закрытия

Рекомендуется хранить задачи в отдельной рабочей папке и указать её в **Настройки → Хранение**.

---

## 11. Маршруты UI

| Путь | Страница |
| --- | --- |
| `/` | Главная |
| `/tasks` | Задачи (карточка + недавние + экспорт ПМИ) |
| `/tasks/test-cases` | Список тест-кейсов |
| `/tasks/test-cases/:id` | Редактор тест-кейса |
| `/settings` | Настройки |

Используется **HashRouter** (`#/tasks` и т.д.) — удобно для `file://` в Electron.

---

## 12. Краткая инструкция пользователя

1. **Новая задача** — заполнить карточку ПМИ → «Создать задачу».
2. Перейти в **Тест-кейсы** → создать сценарии, шаги, скриншоты, итог.
3. **Сохранить** задачу на диск (`Ctrl+S` / «Сохранить как»).
4. **Экспорт Word** — получить ПМИ со всеми заполненными разделами и сценариями.
5. При необходимости настроить тему, autosave и состав экспорта в **Настройки**.

Горячие клавиши по умолчанию (меняются в настройках):

| Действие | Клавиши |
| --- | --- |
| Сохранить | Ctrl+S |
| Сохранить как | Ctrl+Shift+S |
| Открыть | Ctrl+O |
| Новый тест-кейс | Ctrl+N |
| Поиск в списке | Ctrl+F |

---

## 13. Конфигурация сборки Electron

В `package.json` → `"build"`:

- `appId`: `com.testcase.manager`
- `productName`: `Test Case Manager`
- `directories.output`: `release`
- Windows target: **NSIS**

В сборку входят `dist/**` и `dist-electron/**`.

---

## 14. Типичные проблемы

| Проблема | Решение |
| --- | --- |
| Не открываются/не сохраняются файлы | Запускать через `npm run dev` (Electron), не через голый браузер |
| Порт 5173 занят | Остановить другой Vite/процесс или сменить порт в `vite.config.ts` |
| `npm run build` долго качает tools | Нужен доступ в интернет при первом electron-builder |
| Recovery снова предлагает восстановление | После «Восстановить» данные остаются dirty до сохранения на диск — это ожидаемо; после Save recovery очищается |

Проверки качества:

```powershell
npm run typecheck
npm run lint
npm run build:vite
```

---

## 15. Оценка готовности

Приложение функционально целостно для ежедневной работы с задачами, тест-кейсами и экспортом ПМИ. Рекомендуется перед массовым внедрением:

1. Ручной smoke в Electron (создание → кейсы → save → export DOCX → recovery).
2. Сверка экспортированного ПМИ с корпоративным образцом.
3. Сборка installer (`npm run build`) и установка на чистую машину.

---

## 16. Контакты по репозиторию

Локальный каталог разработки:

`C:\Users\ad.kukayeva\Work_PEGA\Projects\test-case-manager`
