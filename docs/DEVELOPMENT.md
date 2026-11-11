# Development

## English

Use Node.js 22.12+ or 24 LTS. BeliLog uses React 19, TypeScript and Vite, without a data backend.

```bash
npm ci
npm run dev
```

Vite prints its local address, usually `http://localhost:5173`. Development, preview and the published site have separate browser storage origins. Transfer data using a full PDF/JSON backup.

### Build and verify

```bash
npm test
npm run build
npm run preview
```

The service worker is generated for production builds; use `preview` to check installation and offline startup. Browser regressions run against the Pages production build:

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

The browser runner starts its own preview on port 5175. Set `BELILOG_URL` to use an existing preview or `CHROMIUM_PATH` to use an installed Chromium browser. The suites cover storage conflicts and recovery, import/export, purchase confirmation, budgets, streaks, navigation, mobile layouts, keyboard use, contrast, offline delivery and automatic-rate behavior. API success and failure cases use controlled responses rather than depending on current market values.

The 2.9.0 baseline passed 590 unit tests and 176 production browser scenarios. Current release details are recorded in the [changelog](../CHANGELOG.md) and [GitHub releases](https://github.com/riokoqee/belilog/releases).

Storage microbenchmarks run separately:

```bash
npx vitest bench src/lib/storage/storage.bench.ts --run
```

### Offline delivery and updates

Production output includes a web app manifest and a service worker. Initial installation caches the complete built app, including lazy routes/dialogs, images, local fonts and PDF assets. **Offline ready** is shown only after preparation succeeds. Test cold offline startup in a production preview after that status appears; the Vite development server is not an offline build.

The worker serves versioned app assets from its own scope. Development `/` and Pages `/belilog/` paths remain independent. It does not store financial data or cache external exchange-rate requests; records remain in the existing validated `localStorage` pipeline.

Updates do not force a reload or call `skipWaiting`. A complete replacement waits until all BeliLog tabs/windows are closed, then activates for the next opening. This avoids mixing a new shell with old lazy modules during editing. Failed installation leaves the previous complete cache available. Browser cache/storage eviction and deliberate clearing can still remove offline files or user data, so PWA installation does not replace backups.

Service workers require HTTPS, with localhost allowed for development. Lifecycle reference: [MDN — Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

### Exchange rates and data compatibility

Manual rates remain the default and make no requests to a rate service. The optional automatic mode calls [Frankfurter v2](https://frankfurter.dev/) for USD → EUR/KZT reference rates. The app checks once per local calendar day on opening, returning to the foreground or reconnecting; a user can also request a refresh. Pair-specific publication dates and the source are displayed, and the last successful values remain usable offline or after an error.

Automatic-rate metadata uses format 5. Formats 1–4 still import in manual mode. Full PDF/JSON backups include rates, source dates and refresh settings. Saving a response uses the same conflict-aware storage pipeline as other profile changes; switching mode cancels an obsolete response. Rate changes recalculate converted views without rewriting source transaction amounts or budgets.

Frankfurter provides indicative reference rates, not live trading quotes. A request contains the requested currency pairs; the application does not send financial records or profile fields. No API secret is required.

### Deploy

[The Pages workflow](../.github/workflows/pages.yml) installs locked dependencies, runs unit tests, builds, runs browser tests, then publishes `dist/`. It runs on pushes to `main` and supports manual dispatch. `GITHUB_PAGES=true` selects `/belilog/`; local builds use `/`. Hash navigation needs no server route rules. Linux CI installs Chromium with `npx playwright install --with-deps chromium`.

### Project map

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Composition of route, data and domain controllers; 107 lines in 2.9. |
| `src/pages/` | Overview, tracker and profile, loaded on demand. |
| `src/components/` | Forms, dialogs, shopping, charts, streaks and profile settings. |
| `src/hooks/` | Domain actions, dialogs, hash routing, profile drafts and data transfer. |
| `src/lib/finance.ts`, `src/lib/appDataVersion.ts` | Data types, validation, migrations and canonical versions. |
| `src/lib/currency.ts`, `src/lib/exchangeRateFeed.ts` | Currency conversion and the opt-in reference-rate provider. |
| `src/lib/pwaClient.ts`, `src/hooks/usePwa.ts` | Service-worker lifecycle and installation state. |
| `src/lib/storage/` | Validated commits, recovery and merging tab changes. |
| `src/lib/pdf.ts`, `src/lib/dataExport.ts` | Reports, full backups, import and CSV. |
| `src/lib/streak/`, `src/lib/shopping/` | Confirmed days, freezes, ranks and shopping operations. |
| `src/lib/messages.ts`, `src/lib/localizedError.ts` | Typed RU/EN keys and errors. |
| `src/styles.css`, `src/motion.css` | Themes, responsive layout and motion. |
| `tests/` | Production browser regressions. |

Behavioral details: [user guide](USAGE.ru.md), [streaks](STREAKS.md), [design](DESIGN_REDESIGN.md), [performance](PERFORMANCE.md) and [asset notices](ASSETS.md).

## Русский

Нужен Node.js 22.12+ или 24 LTS. Команды запуска, сборки и проверок приведены выше. Серверной части для хранения данных нет; локальный и опубликованный сайты используют разные хранилища браузера. Для переноса нужна полная PDF/JSON-копия.

### PWA и офлайн

Manifest и service worker создаются в производственной сборке. Для проверки используйте `npm run build` и `npm run preview`, а не сервер разработки. На первом открытии с интернетом сохраняются все страницы, редакторы, изображения и шрифты, включая PDF. Готовность проверяйте по статусу **«Готово офлайн»** в профиле.

Обновление ждёт закрытия всех вкладок и окон BeliLog, затем применяется при следующем открытии. Принудительной перезагрузки и `skipWaiting` нет. Неудачная подготовка новой версии не заменяет прежний полный кэш. Worker не хранит финансовые данные и не кэширует ответы внешнего API; существующая проверка `localStorage`, конфликтов и восстановления сохраняется. Установка не заменяет резервную копию и не защищает от очистки данных браузером.

Service worker работает через HTTPS и на localhost. Путь `/belilog/` учитывается при сборке для GitHub Pages; его кэш отделён от обычного локального `/`. Жизненный цикл описан в [документации MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

### Автоматические курсы

Ручной режим остаётся исходным и не обращается к сервису курсов. После отдельного включения приложение запрашивает справочные USD → EUR/KZT у [Frankfurter v2](https://frankfurter.dev/): раз в местный календарный день при открытии, возврате во вкладку или восстановлении сети, а также по кнопке обновления. Источник и даты отдельных валют показываются в интерфейсе. Без сети и при ошибке остаются последние успешные значения; исходные расходы и бюджет не переписываются.

Настройки обновления и даты источника используют формат 5 и входят в полные PDF/JSON-копии. Форматы 1–4 продолжают импортироваться в ручном режиме. При возврате в ручной режим устаревший ответ не применяется. Во внешний запрос не включаются расходы, имя или аватар; ключ API не требуется.

### Проверки и публикация

Браузерные сценарии проверяют производственную сборку; ответы сервиса курсов подменяются управляемыми данными, чтобы проверки не зависели от текущего рынка. `BELILOG_URL` позволяет использовать готовый preview, `CHROMIUM_PATH` — установленный Chromium. Базовая версия 2.9.0 прошла 590 модульных тестов и 176 браузерных сценариев; результаты новых версий публикуются в [релизах](https://github.com/riokoqee/belilog/releases).

[Workflow Pages](../.github/workflows/pages.yml) запускает модульные тесты, собирает сайт, выполняет браузерные проверки и публикует `dist/`. Коммит в `main` или ручной запуск запускает эту цепочку. Для Pages используется `GITHUB_PAGES=true`; навигация через `#` не требует серверных правил.

Карта исходников находится в таблице выше. Пользовательские правила приведены в [руководстве](USAGE.ru.md), правила серий — в [STREAKS.md](STREAKS.md), источники изображений и уведомления — в [ASSETS.md](ASSETS.md).
