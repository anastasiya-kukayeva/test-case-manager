# Карта репозитория

Проверено: 2026-10-15

Если сегодняшняя дата больше этой даты на месяц или дольше, сверка обязательна до опоры на карту:

1. Пройти `src/`, `electron/`, `scripts/`: каталоги, страницы, сторы, `src/routes/paths.ts`, `src/routes/AppRouter.tsx`.
2. Сверить слои, таблицу «куда идти», маршруты и дерево с кодом.
3. Если карта разъехалась — обновить этот файл и краткий указатель в `.cursor/rules/project-map.mdc`.
4. В обоих случаях записать сегодняшнюю дату в строку `Проверено:` в формате `YYYY-MM-DD`.

Десктопное приложение (Electron + React) для методик испытаний: задачи `*.tctask`, тест-кейсы, справочник, регресс, экспорт в Word. Продукт и запуск — в `README.md`. Этот файл — куда идти в коде.

Импорты из `src` идут через алиас `@/` (`@/stores/useProjectStore`). Роутер — `HashRouter` в `src/providers/AppProviders.tsx`. Файлы и диалоги работают только в Electron, не в голом браузере.

В коде задача часто называется project: `useProjectStore`, `projectActions`, `ProjectDocument`. В интерфейсе и на диске это задача: `*.tctask`, старое расширение `*.tcproj`. `src/pages/TasksPage.tsx` — только реэкспорт `TasksListPage`.

## Слои

Зависимости идут вниз: UI → application → domain. Infrastructure вызывает Electron и не импортируется из domain.

| Слой | Каталог | Что класть |
| --- | --- | --- |
| Домен | `src/domain` | Типы, Zod, фабрики, подписи. Без React и без диска. |
| Сценарии | `src/application` | Действия: открыть, сохранить, экспорт, фильтры. |
| Инфраструктура | `src/infrastructure` | Формат файла, DOCX, импорт Word, `electron-store`. |
| UI | `src/pages`, `src/components`, `src/layouts` | Страницы и виджеты. Страница вызывает application, не пишет файл сама. |
| Состояние | `src/stores` | Zustand. |
| Процесс ОС | `electron/` | Окно, IPC, `electron-store`. Renderer ходит сюда через `window.electronAPI` (`electron/preload.ts`). |

Поток сохранения: страница → `src/application/project/projectActions.ts` → `src/stores/useProjectStore.ts` и `src/infrastructure/project/projectFileService.ts` → `electron/ipc/handlers.ts`.

## Куда идти

| Задача | Файлы |
| --- | --- |
| Новый маршрут или пункт меню | `src/routes/paths.ts`, `src/routes/AppRouter.tsx`, `src/layouts/AppSidebar.tsx`, страница в `src/pages/` |
| Поля карточки задачи | `src/domain/types/task.ts`, `src/pages/TaskDetailPage.tsx`, `src/domain/factories/createEntities.ts`, `src/infrastructure/project/tcprojFormat.ts` |
| Иерархия задач (родитель / перенос) | `src/domain/utils/taskTree.ts`, `src/application/project/taskHierarchyActions.ts`, `src/components/tasks/` |
| Модель тест-кейса | `src/domain/types/testCase.ts`, `src/domain/schemas/testCaseSchema.ts`, `src/domain/types/attachment.ts`, `src/domain/types/enums.ts` |
| Редактор кейса | `src/pages/TestCaseEditorPage.tsx`, `src/components/editor/` (TipTap — `FormRichTextEditor.tsx`, шаги и скриншоты рядом) |
| Список кейсов текущей задачи | `src/pages/TestCasesPage.tsx`, `src/components/testCases/`, фильтры UI — `src/stores/useTestCaseTableStore.ts` |
| Все кейсы по недавним задачам | `src/pages/AllTestCasesPage.tsx`, `src/application/testCases/loadCatalogTestCases.ts` |
| CRUD, порядок, нумерация кейсов | `src/application/testCases/testCaseActions.ts`, `src/application/testCases/renumberTestCases.ts`, `src/stores/useProjectStore.ts` |
| Открытие, сохранение, «Сохранить как» | `src/application/project/projectActions.ts`, `src/infrastructure/project/projectFileService.ts`, `src/infrastructure/project/tcprojFormat.ts` |
| Автосохранение и recovery | `src/hooks/useProjectAutosave.ts`, `src/infrastructure/project/recoveryService.ts`, `src/components/project/RecoveryModal.tsx` |
| Экспорт ПМИ в Word | `src/application/export/exportActions.ts`, `src/infrastructure/export/docxExportService.ts`, `src/infrastructure/export/exportUtils.ts` |
| Отчёт регресса в Word | `src/infrastructure/export/regressionReportDocx.ts` |
| Импорт из Word | `src/application/import/wordImportActions.ts`, `src/infrastructure/import/docxImportService.ts`, `src/infrastructure/import/parsePmiWordHtml.ts`; кнопка — `src/components/testCases/ImportWordTestCasesButton.tsx` |
| Импорт отчёта регресса | `src/application/import/regressionReportImportActions.ts`, `src/infrastructure/import/regressionReportImportService.ts`, `src/infrastructure/import/parseRegressionReportHtml.ts` |
| Регресс | `src/pages/RegressionPage.tsx`, `RegressionBrowsePage.tsx`, `RegressionScopeCasesPage.tsx`, `RegressionCasesPage.tsx`, `src/application/regression/` |
| Приложения | `src/pages/ApplicationsPage.tsx`, `src/application/applications/loadApplicationTaskGroups.ts` |
| Справочник (люди, приложения, модули, среды) | `src/domain/types/directory.ts`, `src/stores/useDirectoryStore.ts`, `src/pages/DirectoryPage.tsx`, селекты в `src/components/directory/` |
| Настройки, тема, горячие клавиши | `src/pages/SettingsPage.tsx`, `src/application/settings/settingsActions.ts`, `src/domain/types/settings.ts`, `src/stores/useAppStore.ts`, `src/theme/`, `src/hooks/useProjectHotkeys.ts`, `src/utils/hotkeys.ts` |
| Оболочка (шапка, сайдбар, футер) | `src/layouts/` |
| Ошибки и подтверждения | `src/application/errors/`, `src/application/ui/confirmAction.tsx`, `src/components/ui/ErrorBoundary.tsx` |
| Диалоги и запись на диск | `electron/ipc/channels.ts`, `electron/ipc/handlers.ts`, `electron/preload.ts`; ключи store — `src/infrastructure/storage/storageKeys.ts`, обёртка — `src/infrastructure/storage/appStorageService.ts` |
| Окно Electron и сборка | `electron/main.ts`, `vite.config.ts`, `scripts/build-release.mjs`, блок `"build"` в `package.json` |

## Состояние (Zustand)

| Стор | Содержимое |
| --- | --- |
| `src/stores/useProjectStore.ts` | Открытая задача и её тест-кейсы, dirty, недавние. |
| `src/stores/useAppStore.ts` | Настройки, список недавних задач, инициализация. |
| `src/stores/useDirectoryStore.ts` | Справочник и его CRUD. |
| `src/stores/useUiStore.ts` | Сайдбар, занятость, раскрытие дерева задач и регресса. |
| `src/stores/useTestCaseTableStore.ts` | Фильтры, колонки и пагинация таблицы кейсов. |

Старт приложения: `src/main.tsx` → `src/providers/AppProviders.tsx` → `src/providers/AppBootstrap.tsx` → `src/App.tsx` → `src/routes/AppRouter.tsx`.

## Маршруты

Константы — `src/routes/paths.ts`. Страницы кроме главной, списка задач и карточки грузятся через `lazy` в `AppRouter.tsx`.

| Путь | Страница | Меню |
| --- | --- | --- |
| `/` | `HomePage` | Главная |
| `/applications` | `ApplicationsPage` | Приложения |
| `/tasks` | `TasksListPage` | Задачи |
| `/tasks/current` | `TaskDetailPage` | карточка открытой задачи |
| `/tasks/test-cases` | `TestCasesPage` | кейсы открытой задачи |
| `/tasks/test-cases/:id` | `TestCaseEditorPage` | редактор |
| `/test-cases` | `AllTestCasesPage` | Тест-кейсы |
| `/regression` | `RegressionPage` | Регресс |
| `/regression/browse/:mode` | `RegressionBrowsePage` | обход приложения → модуль → задача |
| `/regression/browse/:mode/:scope/:scopeId` | `RegressionScopeCasesPage` | кейсы модуля или задачи |
| `/regression/cases` | `RegressionCasesPage` | кейсы регресса открытой задачи |
| `/directory` | `DirectoryPage` | Справочник |
| `/settings` | `SettingsPage` | Настройки |

`/projects` и `/home` редиректят на `/tasks` и `/`. Хелперы путей регресса: `regressionBrowsePath`, `regressionModuleCasesPath`, `regressionTaskCasesPath` в `paths.ts`.

## Дерево

```text
electron/
  main.ts                 окно
  preload.ts              contextBridge → window.electronAPI
  store.ts                electron-store
  ipc/channels.ts         имена IPC и типы
  ipc/handlers.ts         диалоги, чтение и запись файлов
scripts/
  free-dev-port.mjs       освобождает порт 5173 перед dev
  build-release.mjs       production + NSIS
  win-fs-rename-retry.cjs повтор переименования на Windows
src/
  main.tsx                корень React, Mantine
  application/
    applications/         группы задач по приложениям
    errors/               AppError, тосты
    export/               сценарий экспорта и тост «файл сохранён»
    import/               сценарии импорта Word и отчёта регресса
    project/              открытие, сохранение, иерархия задач
    regression/           группы регресса и поиск
    settings/             запись настроек
    testCases/            CRUD, фильтры, нумерация, маппер формы
    text/                 русская типографика
    ui/                   confirm
  components/
    directory/            селекты справочника
    editor/               форма кейса, TipTap, скриншоты, код
    project/              создание задачи, recovery, ссылки объекта
    tasks/                дерево задач, перенос
    testCases/            таблица, фильтры, импорт, дублирование
    ui/                   skeleton, error boundary
  domain/
    factories/createEntities.ts
    labels/testCaseLabels.ts
    schemas/testCaseSchema.ts
    types/                task, testCase, directory, settings, attachment, enums
    utils/                taskTree, taskDisplay
  hooks/                  autosave, hotkeys, цветовая схема
  infrastructure/
    export/               DOCX ПМИ и отчёт регресса
    import/               разбор Word
    project/              *.tctask, recovery
    storage/              обёртка electron-store и ключи
  layouts/                AppLayout, Header, Sidebar, Footer
  pages/                  по одному экрану на файл
  providers/              провайдеры и bootstrap
  routes/                 paths + AppRouter
  stores/                 пять Zustand-сторов
  styles/global.css
  theme/                  тема Mantine
```

Сборка: `dist/` (UI), `dist-electron/` (main и preload), `release/` (NSIS). Иконка установщика — `build/icon.ico`.

## Проверки

```powershell
npm run dev
npm run typecheck
npm run lint
```
