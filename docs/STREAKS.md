# Tracking streaks and freezes / Серии учёта и заморозки

## English

### Daily tracking

A streak rewards keeping track of money, including days without purchases. A local calendar day is confirmed once by either a newly recorded expense (`LOGGED`) or **Today without spending** (`NO_SPEND`). Multiple expenses, repeated clicks, reloads and concurrent tabs cannot reward the same day twice. Planned shopping items do not confirm a day; entering a real purchase price does.

If a later expense records a purchase on an already confirmed no-spend day, that day's label changes to `LOGGED` without another reward. An unconfirmed past purchase date is not credited automatically; confirming it still requires the backfill action.

Every confirmed day adds one day to the current run and **500,000 fictional berries** to its WANTED bounty. Berries never change expense totals or budgets. Today remains open until local midnight: yesterday's run is still available while today's check-in is pending. An unprotected closed day ends the current run; the best run is retained. A day that has already been earned remains confirmed if its last expense is later deleted. An explicit full restore, reset or demo replacement can replace this history.

### Freeze rules

The user-approved rule is **one freeze for every seven lifetime confirmed tracking days, with a maximum balance of two**. Both `LOGGED` and `NO_SPEND` advance this progress; frozen days do not. Progress does not reset when a streak ends. A reward earned while the balance is already two is discarded, rather than banked for later.

After local midnight, a freeze automatically protects the earliest missed day of an active run. That day becomes `FROZEN`: continuity is preserved, but the streak count, bounty and progress toward another freeze do not increase. If the inventory cannot cover the next missed day, that day is `MISSED` and the current run ends. Freezes are not spent on days after an already broken run. For example, seven confirmed days followed by two closed missed days with one freeze produce `FROZEN`, then `MISSED`; the best stays seven and the current bounty becomes zero.

### Recent days and backfill

The overview and profile display a seven-day strip with a label and icon for each status:

| Status | Meaning |
| --- | --- |
| `LOGGED` | A real expense confirmed the day. |
| `NO_SPEND` | The user confirmed a day without spending. |
| `FROZEN` | A freeze protected a closed missed day. |
| `MISSED` | A closed day has no confirmation or protection. |
| `PENDING` | Today is still open and has not been confirmed. |

Select a recent unconfirmed day to confirm it. If a real expense exists with that purchase or creation date, confirmation uses `LOGGED`; otherwise it uses `NO_SPEND`. No placeholder or zero-value financial transaction is created. A frozen day can be confirmed, returning its freeze through recalculation; that freeze may then protect another eligible missed day. A missed day can also be confirmed and restore continuity if the remaining days connect.

The backfill window is **48 elapsed hours after the target local calendar day ends, including the exact boundary**. The action checks eligibility again when saving, so an old open page cannot bypass expiry. Future days and invalid dates are rejected. Because the window uses elapsed hours, its local wall-clock deadline may shift by one hour across daylight-saving changes.

The year activity heatmap still shows actual expense counts by creation date, falling back to purchase date for legacy records. Its best-streak statistic uses the new tracking history; the seven-day strip shows no-spend and freeze statuses separately.

### Storage, migration and time

`StreakLedger` persists only immutable local date labels and authoritative `LOGGED`/`NO_SPEND` confirmations. Freeze inventory, frozen/missed statuses, current/best runs and berries are derived by deterministic chronological replay. Date unions make concurrent confirmations idempotent; `LOGGED` takes priority over `NO_SPEND` for the same date. There is no independent reward counter to increment twice.

On adoption, existing expense creation dates (`createdAt`, or `date` for older records) populate `LOGGED`. The existing current run, best run and bounty are preserved exactly. Historical confirmations can earn the initial reserve, capped at two, but past gaps before adoption are never retroactively frozen. Automatic protection starts on the adoption day.

Date labels are never converted through UTC or moved into another day after a timezone change. Calendar adjacency remains correct through leap years and 23/25-hour daylight-saving days. Existing future confirmations survive clock rollback but are excluded from current statistics until their date is reached again. A long absence is processed as gaps without writing a row for every missed day.

The first saved tracking history upgrades the complete-data format to **version 3**. It remains in the existing local-storage key and is included in the embedded data of a full PDF backup. Versions 1 and 2 remain importable. New days are unioned when importing records; **Restore everything** deliberately replaces the history with the selected backup. Older application tabs that do not understand version 3 refuse to overwrite it and must be refreshed. Ordinary expense reports remain ordinary reports and do not contain a restorable tracking history.

A changed editor opened before another tab resets or replaces the history is rejected instead of bringing removed days back. Read-only refreshes and concurrent additions remain safe; a real expense may still upgrade `NO_SPEND` to `LOGGED`.

### Implementation and checks

| File | Responsibility |
| --- | --- |
| `src/lib/streakTypes.ts` | Persisted contract, validation and concurrent date union. |
| `src/lib/streakLedger.ts` | Reconciliation, confirmation, automatic freezes, replay and recent-day views. |
| `src/lib/useStreakStats.ts` | Shared local-day clock and cache keyed by immutable transactions and ledger. |
| `src/lib/streakCopy.ts` | English and Russian strings for this feature. |
| `src/components/StreakDays.tsx` | Accessible recent-day selection and confirmation. |
| `src/components/StreakBounty.tsx` | Daily action, inventory, progress and WANTED presentation. |
| `src/components/StreakBadge.tsx`, `src/components/ActivityCalendar.tsx` | Shared tracking statistics in navigation and profile. |
| `src/components/StreakDays.css`, `src/components/StreakBounty.css` | Responsive controls, theme tokens and reduced-motion support. |
| `src/App.tsx` | Atomic persistence with expenses, confirmations, import and transient feedback. |
| `src/lib/finance.ts`, `src/lib/storage.ts` | Version 3 validation, preservation and merging. |
| `src/pages/OverviewPage.tsx`, `src/pages/ProfilePage.tsx`, `src/lib/i18n.tsx`, `index.html` | View integration, localization and saved-theme bootstrap. |
| `src/lib/*.test.ts`, `tests/streak-browser.mjs`, `tests/run-browser.mjs`, `tests/design-browser.mjs` | Domain, storage, PDF, migration, production UI and regression checks. |

Run all unit tests with `npm test`. Focused domain checks:

```bash
npm test -- src/lib/streakLedger.test.ts src/lib/streak.test.ts src/lib/useStreakStats.test.ts
```

Run the production browser checks with:

```bash
GITHUB_PAGES=true npm run build
npx playwright install chromium
npm run test:browser
```

Release 2.7.0 passed **428 unit tests and 151 production browser scenarios**, including 18 tracking-specific browser scenarios. Both the ordinary build and the GitHub Pages build passed. An additional eight mobile checks covered Russian/English, light/dark themes and protected/restarted runs, with no accessibility violations, JavaScript errors or horizontal page overflow; all new buttons measured at least 44 × 44 pixels.

These unit cases include recording/no-spend days, protected and unprotected gaps, two missed days with one freeze, inventory rewards/cap, backfill from frozen/missed, expiry, replay and confirmation idempotency, legacy migration, concurrent merges, midnight, timezone changes and daylight-saving boundaries. Runtime data remains local to each browser; device clocks and dates are trusted, and this feature does not add account synchronization or server-side clock verification.

### Explicit assumptions

The supplied prompt starts midway through its specification. The confirmed seven-day reward rule resolves its missing acquisition rule; the remaining choices used here are: no initial free freeze, progress across all confirmed days rather than just the current run, no stored overflow above two, no berries for a frozen day, the 48-hour window measured after local day-end, retained credit after deleting an expense, and real-expense-aware backfill without creating financial records. Existing users receive historical earned reserve without rewriting old gaps. There is no unresolved choice required to use this version; these economy and timing rules can be adjusted in a later version.

## Русский

### Ежедневный учёт

Серия поощряет ведение финансов, в том числе в дни без покупок. Локальный календарный день засчитывается один раз: новой записью расхода (`LOGGED`) либо кнопкой **«Сегодня без трат»** (`NO_SPEND`). Дополнительные расходы, повторные нажатия, перезагрузка и параллельные вкладки не выдают награду за один день повторно. Запланированные покупки не засчитывают день; сохранение цены реальной покупки засчитывает.

Если позднее внесён расход с датой покупки в уже подтверждённый день без трат, его статус меняется на `LOGGED` без повторной награды. Неподтверждённая прошлая дата покупки автоматически не засчитывается: для неё по-прежнему нужно подтверждение задним числом.

Каждый подтверждённый день добавляет один день к текущей серии и **500 000 игровых берри** к награде WANTED. Берри не меняют расходы и бюджет. Сегодняшний день остаётся открытым до местной полуночи: вчерашняя серия сохраняется, пока сегодняшнее подтверждение ожидается. Закрытый день без защиты прерывает текущую серию; лучшая сохраняется. Уже заработанный день остаётся подтверждённым после удаления последнего расхода за него. Явное полное восстановление, сброс или замена демоданными могут заменить эту историю.

### Правила заморозок

Пользователь подтвердил правило: **одна заморозка за каждые семь подтверждённых дней учёта за всё время, максимум две в запасе**. В прогресс входят `LOGGED` и `NO_SPEND`; замороженные дни не входят. Прогресс не сбрасывается при прерывании серии. Если на очередном пороге уже есть две заморозки, новая не откладывается сверх лимита.

После местной полуночи заморозка автоматически защищает первый пропущенный день активной серии. Он получает статус `FROZEN`: непрерывность сохраняется, но длина серии, награда и прогресс получения заморозки не растут. Если следующему пропущенному дню защиты не хватает, он получает `MISSED`, а текущая серия прерывается. После уже прерванной серии заморозки на пустые дни не расходуются. Например, после семи подтверждённых дней два закрытых пропуска при одной заморозке дают сначала `FROZEN`, затем `MISSED`; лучшая серия остаётся семь, текущая награда становится нулевой.

### Последние дни и подтверждение задним числом

На обзоре и в профиле показана лента семи дней с подписью и значком каждого состояния:

| Статус | Значение |
| --- | --- |
| `LOGGED` | День подтверждён реальным расходом. |
| `NO_SPEND` | Пользователь подтвердил день без трат. |
| `FROZEN` | Заморозка защитила закрытый пропущенный день. |
| `MISSED` | Закрытый день не подтверждён и не защищён. |
| `PENDING` | Сегодняшний день ещё открыт и не подтверждён. |

Выберите недавний неподтверждённый день, чтобы подтвердить его. Если есть реальный расход с такой датой покупки или создания, используется `LOGGED`, иначе — `NO_SPEND`. Фиктивный расход или запись с нулевой суммой не создаются. Подтверждение замороженного дня возвращает защиту через пересчёт; она может защитить другой подходящий пропуск. Подтверждение пропущенного дня также может восстановить непрерывность, если остальные дни соединяются.

Окно подтверждения — **48 фактически прошедших часов после окончания выбранного местного календарного дня, включая точную границу**. Доступность повторно проверяется при сохранении: давно открытая страница не позволяет обойти срок. Будущие и некорректные даты отклоняются. Из-за расчёта прошедших часов местное время окончания окна может сдвинуться на час при переходе на летнее или зимнее время.

Годовой календарь активности по-прежнему показывает количество реальных записей по дате создания, а для старых записей — по дате покупки. Его показатель лучшей серии использует новую историю учёта; дни без трат и заморозки отдельно показаны в ленте семи дней.

### Сохранение, миграция и время

`StreakLedger` сохраняет только неизменяемые местные даты и подтверждения `LOGGED`/`NO_SPEND`. Запас заморозок, состояния пропусков, текущая и лучшая серии и берри вычисляются последовательным детерминированным пересчётом. Объединение дат делает одновременные подтверждения идемпотентными; для одной даты `LOGGED` имеет приоритет над `NO_SPEND`. Отдельного счётчика наград, который можно случайно увеличить дважды, нет.

При переходе существующие даты создания расходов (`createdAt`, а для старых записей — `date`) заполняют `LOGGED`. Текущая и лучшая серии и награда сохраняются без изменения. Исторические подтверждения могут дать начальный заработанный запас до двух заморозок, но старые пропуски до перехода не замораживаются задним числом. Автоматическая защита начинается со дня перехода.

Местные даты не переводятся через UTC и не переносятся на другой день после смены часового пояса. Соседство дней корректно определяется в високосные годы и при 23/25-часовых сутках. Уже сохранённые будущие подтверждения переживают перевод часов назад, но не входят в текущую статистику до повторного наступления своей даты. Долгое отсутствие обрабатывается промежутками, без сохранения отдельной строки на каждый пропущенный день.

Первое сохранение истории учёта переводит формат полных данных в **версию 3**. Ключ локального хранилища сохраняется; история входит во вложенные данные полной PDF-копии. Версии 1 и 2 продолжают импортироваться. При добавлении записей новые подтверждённые дни объединяются; **«Восстановить всё»** намеренно заменяет историю выбранной копией. Старые вкладки, которые не понимают версию 3, отказываются её перезаписывать — их нужно обновить. Обычный отчёт по расходам остаётся отчётом и не содержит восстанавливаемой истории учёта.

Изменённый редактор, открытый до сброса или замены истории в другой вкладке, получает отказ вместо возвращения удалённых дней. Обновление без изменений и одновременное добавление дней безопасны; реальный расход по-прежнему может заменить `NO_SPEND` на `LOGGED`.

### Реализация и проверки

| Файл | Назначение |
| --- | --- |
| `src/lib/streakTypes.ts` | Формат истории, валидация и объединение дат между вкладками. |
| `src/lib/streakLedger.ts` | Подтверждения, автоматические заморозки, пересчёт и последние дни. |
| `src/lib/useStreakStats.ts` | Общие часы местного дня и кеш по неизменяемым расходам и истории. |
| `src/lib/streakCopy.ts` | Английские и русские строки функции. |
| `src/components/StreakDays.tsx` | Доступный выбор и подтверждение недавнего дня. |
| `src/components/StreakBounty.tsx` | Ежедневное действие, запас, прогресс и постер WANTED. |
| `src/components/StreakBadge.tsx`, `src/components/ActivityCalendar.tsx` | Общая статистика учёта в навигации и профиле. |
| `src/components/StreakDays.css`, `src/components/StreakBounty.css` | Адаптивные кнопки, переменные темы и поддержка уменьшенного движения. |
| `src/App.tsx` | Атомарное сохранение с расходами, подтверждения, импорт и обратная связь. |
| `src/lib/finance.ts`, `src/lib/storage.ts` | Валидация, сохранение и объединение формата 3. |
| `src/pages/OverviewPage.tsx`, `src/pages/ProfilePage.tsx`, `src/lib/i18n.tsx`, `index.html` | Подключение страниц, локализация и раннее применение сохранённой темы. |
| `src/lib/*.test.ts`, `tests/streak-browser.mjs`, `tests/run-browser.mjs`, `tests/design-browser.mjs` | Проверки движка, хранилища, PDF, миграции, интерфейса сборки и регрессий. |

Все модульные проверки: `npm test`. Проверки движка отдельно:

```bash
npm test -- src/lib/streakLedger.test.ts src/lib/streak.test.ts src/lib/useStreakStats.test.ts
```

Браузерные проверки производственной сборки:

```bash
GITHUB_PAGES=true npm run build
npx playwright install chromium
npm run test:browser
```

Версия 2.7.0 прошла **428 модульных тестов и 151 браузерный сценарий производственной сборки**, включая 18 сценариев новой механики учёта. Обычная сборка и сборка для GitHub Pages завершились успешно. Дополнительно проверены восемь мобильных сочетаний языка RU/EN, светлой/тёмной темы и сохранённой/прерванной серии: нарушений доступности, ошибок JavaScript и горизонтального переполнения страницы не найдено; все новые кнопки имеют размер не меньше 44 × 44 пикселей.

Модульные сценарии включают запись и день без трат, пропуски с защитой и без неё, два пропуска при одной заморозке, выдачу и потолок запаса, подтверждение замороженного и пропущенного дня, срок подтверждения, идемпотентность, миграцию, объединение вкладок, полночь, смену часового пояса и перевод часов. Данные остаются локальными в браузере; приложение доверяет часам устройства и не добавляет синхронизацию аккаунта или серверную проверку времени.

### Явные допущения

Переданный промпт начинается с середины спецификации. Подтверждённое правило семи дней закрывает отсутствующее условие получения заморозок. Остальные принятые решения: бесплатной стартовой заморозки нет; прогресс считается по всем подтверждённым дням, а не только текущей серии; запас свыше двух не копится; замороженный день не даёт берри; окно 48 часов начинается после местного окончания дня; удаление расхода не отнимает заработанный день; подтверждение учитывает реальные покупки и не создаёт финансовых записей. Существующие пользователи получают заработанный историей запас без изменения старых пропусков. Для работы этой версии нерешённых вопросов нет; экономику и сроки можно изменить в следующей версии.
