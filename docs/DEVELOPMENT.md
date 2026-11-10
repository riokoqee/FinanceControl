# Development

## English

Use Node.js 22.12+ or 24 LTS. The app uses React 19, TypeScript and Vite, without a backend.

```bash
npm ci
npm run dev
```

Vite prints its local address, usually `http://localhost:5173`. Opening the app locally uses a different browser storage origin from the published site. Use a full backup to transfer data.

Local-first describes data storage, not guaranteed offline startup. There is no service worker; the initial app and modules loaded on demand need network access unless the browser already has them cached.

### Build and verify

```bash
npm test
npm run build
npm run preview
```

Browser regressions run against the Pages production build:

```bash
GITHUB_PAGES=true npm run build
npx playwright install chromium
npm run test:browser
```

PowerShell build equivalent:

```powershell
$env:GITHUB_PAGES='true'
npm run build
Remove-Item Env:GITHUB_PAGES
```

The browser runner starts its own preview on port 5175. Set `BELILOG_URL` to use an existing preview or `CHROMIUM_PATH` to use an installed Chromium browser. The suites cover persistence, stale tabs, recovery, PDF import, shopping confirmation, budgets, templates, streaks, hash navigation, profile flushes, safe undo, keyboard use, mobile layouts and contrast in both themes and languages.

Version 2.9 separates domain actions from the application shell (107 lines in `App.tsx`), uses one dialog state and URL route, centralizes format versions and typed RU/EN keys, and returns operation metadata only after a successful storage commit. The suite contains 590 unit tests and 176 production browser scenarios, including neutral onboarding days, all-or-nothing freezes, profile navigation flushes and undo after editing a returned shopping item. Reconciliation reuses immutable transaction/ledger references within a local day; the 48-hour confirmation deadline is checked on every action.

Release 2.8.0 passed 527 unit tests and 165 production browser scenarios, including 14 scenarios for manual rates and JSON/CSV/PDF portability. Ordinary and GitHub Pages builds passed. Three README screenshots use only demo data.

Storage microbenchmarks run separately:

```bash
npx vitest bench src/lib/storage/storage.bench.ts --run
```

### Deploy

[The Pages workflow](../.github/workflows/pages.yml) installs the locked dependencies, runs unit tests, builds, runs browser tests, then publishes `dist/`. It runs on pushes to `main` and supports manual dispatch. `GITHUB_PAGES=true` selects the `/belilog/` base; local development uses `/`. Hash navigation needs no server route rules. For Linux CI, Playwright uses `npx playwright install --with-deps chromium`.

### Project map

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Composition of route, data and domain controllers. |
| `src/pages/` | Overview, tracker and profile, loaded on demand. |
| `src/components/` | Forms, dialogs, shopping, charts and streak presentation. |
| `src/components/AppDialogs.tsx`, `src/components/ExchangeRatesSettings.tsx` | App dialog composition and manual rate settings. |
| `src/lib/finance.ts` | Data types, validation, migrations and currency calculations. |
| `src/lib/currency.ts`, `src/lib/dataExport.ts` | Manual exchange rates and portable JSON/CSV exports. |
| `src/lib/storage/storage.ts` | Validated commits, recovery and merging tab changes. |
| `src/lib/pdf.ts` | Reports, embedded full backups and restore. |
| `src/lib/streak/` | Confirmed days, freezes, recent days, copy and pirate ranks. |
| `src/lib/shopping/` | Purchase-list operations and reusable shopping templates. |
| `src/hooks/` | Domain actions, a single dialog state, hash routing, profile drafts and data transfer. |
| `src/lib/appDataVersion.ts`, `src/lib/messages.ts` | Canonical format versions and typed RU/EN message keys. |
| `src/styles.css`, `src/motion.css` | Semantic themes, responsive layout and motion. |
| `tests/` | Production browser regressions. |

Behavioral details remain in the [user guide](USAGE.ru.md), [streak documentation](STREAKS.md), [design report](DESIGN_REDESIGN.md) and [performance report](PERFORMANCE.md). See [ASSETS.md](ASSETS.md) for bundled asset metadata and notices.

## Русский

Нужен Node.js 22.12+ или 24 LTS. Приложение использует React 19, TypeScript и Vite, серверной части нет.

```bash
npm ci
npm run dev
```

Vite напечатает адрес, обычно `http://localhost:5173`. Локальный и опубликованный сайты используют разные хранилища браузера. Для переноса данных нужна полная резервная копия.

Локальное сохранение не гарантирует запуск без интернета. Service worker отсутствует: первоначальная загрузка приложения и отдельных модулей требует сети, если браузер ещё не сохранил их в своём кэше.

### Сборка и проверки

```bash
npm test
npm run build
npm run preview
```

Браузерные регрессии запускаются по сборке для Pages:

```bash
GITHUB_PAGES=true npm run build
npx playwright install chromium
npm run test:browser
```

В PowerShell вместо первой строки:

```powershell
$env:GITHUB_PAGES='true'
npm run build
Remove-Item Env:GITHUB_PAGES
```

Браузерный сценарий сам запускает preview на порту 5175. Для готового preview задайте `BELILOG_URL`, для установленного Chromium — `CHROMIUM_PATH`. Проверяются сохранение, устаревшие вкладки, восстановление, PDF, подтверждение покупок, бюджеты, шаблоны, серии, клавиатура, мобильная вёрстка и контраст обеих тем на двух языках.

В версии 2.9 операции вынесены из оболочки приложения (`App.tsx` — 107 строк). У диалогов единое состояние, маршрут берётся из URL; версии формата и типизированные ключи RU/EN централизованы. Результат операции возвращается только после успешной записи в хранилище. Набор содержит 590 модульных тестов и 176 браузерных сценариев: нейтральные дни до начала учёта, защита всего пропуска, сохранение профиля при навигации и отмена удаления после изменения возвращённого товара. Пересчёт переиспользует неизменяемые ссылки на расходы и историю в пределах местного дня; срок подтверждения 48 часов проверяется при каждом действии.

Версия 2.8.0 прошла 527 модульных тестов и 165 браузерных сценариев производственной сборки, включая 14 сценариев ручных курсов и переноса JSON/CSV/PDF. Обычная сборка и сборка для GitHub Pages завершились успешно. На трёх скриншотах README показаны только демоданные.

Отдельный микрозамер хранилища:

```bash
npx vitest bench src/lib/storage/storage.bench.ts --run
```

### Публикация

[Workflow Pages](../.github/workflows/pages.yml) устанавливает зависимости по lock-файлу, запускает модульные тесты, собирает сайт, проверяет его браузером и публикует `dist/`. Он запускается при коммите в `main` или вручную. Переменная `GITHUB_PAGES=true` задаёт путь `/belilog/`, локальная разработка использует `/`. Навигация с `#` не требует серверных правил. В Linux CI браузер устанавливается командой `npx playwright install --with-deps chromium`.

Карта исходников приведена в таблице выше. Подробные правила — в [руководстве](USAGE.ru.md), [описании серий](STREAKS.md), [отчёте о дизайне](DESIGN_REDESIGN.md) и [производительности](PERFORMANCE.md). Источники ассетов и приложенные уведомления перечислены в [ASSETS.md](ASSETS.md).

### Подробная структура исходников


```text
src/App.tsx                       композиция контроллеров (107 строк)
src/components/AppDialogs.tsx     общая композиция диалогов приложения
src/components/ExchangeRatesSettings.tsx ручные курсы валют
src/hooks/useDataTransfer.ts      PDF/JSON/CSV, импорт и резервные копии
src/hooks/useShoppingActions.ts   операции списка покупок
src/hooks/useShoppingTemplates.ts шаблоны
src/hooks/useTransactions.ts      расходы и безопасная отмена удаления
src/hooks/useTrackingActions.ts   подтверждение дней учёта
src/hooks/useBackupRestore.ts     импорт, восстановление, демо и сброс
src/hooks/useDialogState.ts       единое состояние открытого диалога
src/hooks/useHashPage.ts          маршрут из URL и сохранение черновика
src/lib/currency.ts               ручные и примерные курсы валют
src/lib/dataExport.ts             JSON-копии, CSV и чтение файлов
src/pages/                        обзор, трекер и профиль, загружаемые по запросу
src/components/Modal.tsx          общее модальное окно и управление фокусом
src/components/TransactionDialog.tsx редактор расхода, загружаемый по запросу
src/components/ActivityCalendar.tsx календарь записей
src/components/EntryDetails.tsx     состав покупки
src/components/ShoppingList.tsx    планы покупок и автоматическое сохранение цены
src/components/ShoppingTemplatesDialog.tsx шаблоны покупок, загружаемые по запросу
src/components/CategoryBudgetsDialog.tsx редактор лимитов, загружаемый по запросу
src/lib/shopping/templates.ts               сохранение и применение шаблонов без дублей
src/lib/budgets.ts                 месячный прогресс лимитов с пересчётом валют
src/components/TransactionTable.tsx стабильная таблица и постраничная навигация
src/components/ExpenseChart.tsx    график с клавиатурным управлением и выбором дня
src/lib/storage/storage.ts                восстановление и объединение изменений вкладок
src/lib/storage/storage.test.ts           проверки повреждений, конфликтов и лимитов
src/hooks/usePersistentData.ts      запись перед обновлением интерфейса
src/hooks/useProfileDraft.ts        черновик профиля и отложенное сохранение
src/lib/expenses.ts               сводка, поисковый индекс и сортировка
src/lib/shopping/shopping.ts                связь списка с расходами и разбор цены
src/lib/shopping/shopping.test.ts           проверки цен, сохранения, связей и старых копий
src/lib/finance.ts                 типы, миграция, валидация, валюты
src/lib/finance.test.ts            тесты хранения и расчётов
src/lib/i18n.tsx                   контекст языка и типизированный перевод
src/lib/messages.ts               ключи и словари RU/EN
src/lib/localizedError.ts         локализованные ошибки по ключам
src/lib/appDataVersion.ts         версии формата и выбор по данным
src/lib/pdf.ts                     PDF, вложенная копия, восстановление
src/lib/pdf.test.ts                проверки PDF и вложений
src/lib/avatar.ts                  геометрия кадрирования и сохранение аватара
src/lib/avatar.test.ts             проверки области кадрирования
src/components/AvatarCropper.tsx   редактор фото
src/lib/streak/streak.ts                  серии дней и награда
src/lib/streak/streakLedger.ts            дни учёта, заморозки и подтверждения задним числом
src/lib/streak/streakTypes.ts             формат истории, проверка и объединение дат
src/lib/streak/streakCopy.ts              локализация механики серии RU/EN
src/lib/streak/streakLedger.test.ts       проверки миграции, защиты, идемпотентности и времени
src/lib/streak/streak.test.ts             проверки серий, календарных границ и наград
src/lib/streak/pirateRanks.ts             ранги, прогресс и условия повышения награды
src/lib/streak/pirateRanks.test.ts        проверки порогов рангов и ежедневного повышения
src/hooks/useStreakStats.ts          общий календарный таймер и кеш серий
src/components/StreakBadge.tsx     серия в меню
src/components/StreakBounty.tsx    постеры WANTED
src/components/StreakDays.tsx      лента последних дней и подтверждение пропусков
src/components/StreakBounty.css    пергамент, ранги, тление и частицы
src/motion.css                    обратная связь и анимации
src/styles.css                    палитра, темы и адаптивная вёрстка
tests/                            браузерные регрессии и проверки контраста
```
