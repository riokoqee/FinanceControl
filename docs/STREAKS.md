# Tracking streaks and freezes / Серии учёта и заморозки

## English

### Daily tracking

A streak rewards keeping track of money, including days without purchases. A local calendar day is confirmed once by either a newly recorded expense (`LOGGED`) or **Today without spending** (`NO_SPEND`). Multiple expenses, repeated clicks, reloads and concurrent tabs cannot reward the same day twice. Planned shopping items do not confirm a day; entering a real purchase price does.

If a later expense records a purchase on an already confirmed no-spend day, that day's label changes to `LOGGED` without another reward. An unconfirmed past purchase date is not credited automatically; confirming it still requires the backfill action.

Every confirmed day adds one day to the current run and **500,000 fictional berries** to its WANTED bounty. Berries never change expense totals or budgets. Today remains open until local midnight: yesterday's run is still available while today's check-in is pending. An unprotected closed day ends the current run; the best run is retained. A day that has already been earned remains confirmed if its last expense is later deleted. An explicit full restore, reset or demo replacement can replace this history.

### Freeze rules

The user-approved rule is **one freeze for every seven lifetime confirmed tracking days, with a maximum balance of two**. Both `LOGGED` and `NO_SPEND` advance this progress; frozen days do not. Progress does not reset when a streak ends. A reward earned while the balance is already two is discarded, rather than banked for later.

Protection is **all or nothing for the entire consecutive closed gap of an active run**. If the reserve covers every missed day, all become `FROZEN` and one freeze is spent per day. Continuity is preserved, but the streak count, bounty and reward progress do not increase. If the reserve is insufficient, the whole gap is `MISSED`, the run ends and the reserve is left untouched. No partial protection is spent.

For example, seven confirmed days followed by two closed missed days with one freeze produce **two `MISSED` days and one remaining freeze**; the best stays seven and the current bounty becomes zero. Backfilling yesterday can reduce the remaining gap to one day, allowing the preserved freeze to reconnect the run. Because statuses are replayed, a protected one-day gap that later grows beyond the reserve becomes entirely `MISSED` and its reserve returns. Empty days after an already broken run do not consume freezes.

### Recent days and backfill

The overview and profile display a seven-day strip with a label and icon for each status:

| Status | Meaning |
| --- | --- |
| `LOGGED` | A real expense confirmed the day. |
| `NO_SPEND` | The user confirmed a day without spending. |
| `FROZEN` | A freeze protected a closed missed day. |
| `MISSED` | A closed day has no confirmation or protection. |
| `PENDING` | Today is still open and has not been confirmed. |
| `NONE` | Before tracking began; neutral and unavailable for backfill. |

Tracking begins at the earlier of `startedOn` and the first confirmed date. Fresh installations show neutral earlier days rather than missed obligations; merely viewing them does not write a ledger. Today remains available even after a clock rollback. A backdated first purchase credits its creation day without opening days before tracking began.

Select a recent unconfirmed day to confirm it. If a real expense exists with that purchase or creation date, confirmation uses `LOGGED`; otherwise it uses `NO_SPEND`. No placeholder or zero-value financial transaction is created. A frozen day can be confirmed, returning its freeze through recalculation; that freeze may then protect another eligible missed day. A missed day can also be confirmed and restore continuity if the remaining days connect.

The backfill window is **48 elapsed hours after the target local calendar day ends, including the exact boundary**. The central `confirmDay` action checks eligibility again when saving and chooses the real-expense/no-spend status; an old open page cannot bypass expiry. Future days, invalid dates and past days before tracking began are unavailable. Because the window uses elapsed hours, its local wall-clock deadline may shift by one hour across daylight-saving changes.

The year activity heatmap still shows actual expense counts by creation date, falling back to purchase date for legacy records. Its best-streak statistic uses the new tracking history; the seven-day strip shows no-spend and freeze statuses separately.

### Storage, migration and time

`StreakLedger` persists only immutable local date labels and authoritative `LOGGED`/`NO_SPEND` confirmations. Freeze inventory, frozen/missed statuses, current/best runs and berries are derived by deterministic chronological replay. Date unions make concurrent confirmations idempotent; `LOGGED` takes priority over `NO_SPEND` for the same date. There is no independent reward counter to increment twice.

On adoption, existing expense creation dates (`createdAt`, or `date` for older records) populate `LOGGED`. The existing current run, best run and bounty are preserved exactly. Historical confirmations can earn the initial reserve, capped at two, but past gaps before adoption are never retroactively frozen. Automatic protection starts on the adoption day.

Date labels are never converted through UTC or moved into another day after a timezone change. Calendar adjacency remains correct through leap years and 23/25-hour daylight-saving days. Existing future confirmations survive clock rollback but are excluded from current statistics until their date is reached again. A long absence is processed as gaps without writing a row for every missed day.

Tracking history uses complete-data **format 3 or newer**; it was introduced in version 3. It remains in the existing local-storage key and is included in full PDF and JSON backups. Versions 1 and 2 remain importable. New days are unioned when importing records; **Restore everything** deliberately replaces the history with the selected backup. Older application tabs that do not understand the saved format refuse to overwrite it and must be refreshed. Ordinary expense reports remain ordinary reports and do not contain a restorable tracking history.

Profiles with manually saved exchange rates use **format 4** and keep the same tracking history. Full PDF and JSON backups include it; formats 1–3 remain importable. Rates never affect fictional berries.

A changed editor opened before another tab resets or replaces the history is rejected instead of bringing removed days back. Read-only refreshes and concurrent additions remain safe; a real expense may still upgrade `NO_SPEND` to `LOGGED`.

### Implementation and checks

| File | Responsibility |
| --- | --- |
| `src/lib/streak/streakTypes.ts` | Persisted contract, validation and concurrent date union. |
| `src/lib/streak/streakLedger.ts` | Reconciliation, central `confirmDay`, all-or-nothing freezes, replay and recent-day eligibility. |
| `src/lib/streak/withTrackingDays.ts`, `src/lib/appDataVersion.ts` | Preserve daily facts with an expense in one mutation and select the feature-bearing data format. |
| `src/hooks/useStreakStats.ts` | Shared local-day clock and cache keyed by immutable transactions and ledger. |
| `src/lib/streak/streakCopy.ts` | English and Russian strings for this feature. |
| `src/components/StreakDays.tsx` | Accessible recent-day selection and confirmation. |
| `src/components/StreakBounty.tsx` | Daily action, inventory, progress and WANTED presentation. |
| `src/components/StreakBadge.tsx`, `src/components/ActivityCalendar.tsx` | Shared tracking statistics in navigation and profile. |
| `src/components/StreakDays.css`, `src/components/StreakBounty.css` | Responsive controls, theme tokens and reduced-motion support. |
| `src/hooks/useAppData.ts`, `src/hooks/usePersistentData.ts` | Atomic persistence; operation metadata comes only from the successfully committed retry. |
| `src/hooks/useTrackingActions.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useShoppingActions.ts`, `src/hooks/useBackupRestore.ts` | Domain actions, confirmations, import and transient feedback; App connects them to views. |
| `src/lib/finance.ts`, `src/lib/storage/storage.ts` | Tracking validation, preservation and merging, including format 4 profiles. |
| `src/pages/OverviewPage.tsx`, `src/pages/ProfilePage.tsx`, `src/lib/i18n.tsx`, `index.html` | View integration, localization and saved-theme bootstrap. |
| `src/lib/streak/*.test.ts`, `src/hooks/useStreakStats.test.ts`, `tests/streak-browser.mjs`, `tests/run-browser.mjs`, `tests/design-browser.mjs` | Domain, storage, PDF, migration, production UI and regression checks. |

Reconciliation caches one latest snapshot per immutable transaction-array reference and ledger/local-day combination. Replay caches one latest local day per immutable ledger reference. Widget reads reuse these snapshots instead of rescanning large histories; new references or a new day invalidate them. Exact 48-hour eligibility is checked outside the replay cache, so it still expires within the same day. App state and cached snapshots must remain immutable. Retried operations return `{ data, result }` and publish feedback only after the primary write succeeds; failed attempts cannot leak a reward or toast.

Run all unit tests with `npm test`. Focused domain checks:

```bash
npm test -- src/lib/streak src/lib/storage/storage.test.ts src/hooks/useStreakStats.test.ts
```

Run the production browser checks with:

```bash
GITHUB_PAGES=true npm run build
npx playwright install chromium
npm run test:browser
```

Historical verification: release 2.7.0 passed **428 unit tests and 151 production browser scenarios**, including 18 tracking-specific browser scenarios. Both the ordinary build and the GitHub Pages build passed. An additional eight mobile checks covered Russian/English, light/dark themes and protected/restarted runs, with no accessibility violations, JavaScript errors or horizontal page overflow; all new buttons measured at least 44 × 44 pixels.

Current cases cover recording/no-spend days, whole-gap protection, insufficient reserve without partial spending, inventory rewards/cap, backfill from frozen/missed, expiry, neutral onboarding, replay and confirmation idempotency, legacy migration, concurrent merges, failed writes, immutable-reference caches, midnight, timezone changes and daylight-saving boundaries. Runtime data remains local to each browser; device clocks and dates are trusted, and this feature does not add account synchronization or server-side clock verification.

### Explicit assumptions

The supplied prompt starts midway through its specification. The confirmed seven-day reward rule resolves its missing acquisition rule; the remaining choices used here are: no initial free freeze, progress across all confirmed days rather than just the current run, no stored overflow above two, no berries for a frozen day, the 48-hour window measured after local day-end, retained credit after deleting an expense, and real-expense-aware backfill without creating financial records. Existing users receive historical earned reserve without rewriting old gaps. There is no unresolved choice required to use this version; these economy and timing rules can be adjusted in a later version.

## Русский

### Ежедневный учёт

Серия поощряет ведение финансов, в том числе в дни без покупок. Локальный календарный день засчитывается один раз: новой записью расхода (`LOGGED`) либо кнопкой **«Сегодня без трат»** (`NO_SPEND`). Дополнительные расходы, повторные нажатия, перезагрузка и параллельные вкладки не выдают награду за один день повторно. Запланированные покупки не засчитывают день; сохранение цены реальной покупки засчитывает.

Если позднее внесён расход с датой покупки в уже подтверждённый день без трат, его статус меняется на `LOGGED` без повторной награды. Неподтверждённая прошлая дата покупки автоматически не засчитывается: для неё по-прежнему нужно подтверждение задним числом.

Каждый подтверждённый день добавляет один день к текущей серии и **500 000 игровых берри** к награде WANTED. Берри не меняют расходы и бюджет. Сегодняшний день остаётся открытым до местной полуночи: вчерашняя серия сохраняется, пока сегодняшнее подтверждение ожидается. Закрытый день без защиты прерывает текущую серию; лучшая сохраняется. Уже заработанный день остаётся подтверждённым после удаления последнего расхода за него. Явное полное восстановление, сброс или замена демоданными могут заменить эту историю.

### Правила заморозок

Пользователь подтвердил правило: **одна заморозка за каждые семь подтверждённых дней учёта за всё время, максимум две в запасе**. В прогресс входят `LOGGED` и `NO_SPEND`; замороженные дни не входят. Прогресс не сбрасывается при прерывании серии. Если на очередном пороге уже есть две заморозки, новая не откладывается сверх лимита.

Защита применяется **целиком ко всему последовательному закрытому пропуску активной серии**. Если запаса хватает на каждый день, все дни получают `FROZEN`, а за каждый расходуется одна заморозка. Непрерывность сохраняется, но длина серии, награда и прогресс не растут. Если запаса недостаточно, весь промежуток получает `MISSED`, серия прерывается, запас остаётся нетронутым. Частичная защита не расходуется.

Например, после семи подтверждённых дней два закрытых пропуска при одной заморозке дают **два дня `MISSED` и одну оставшуюся заморозку**; лучшая серия остаётся семь, текущая награда равна нулю. Подтверждение вчерашнего дня может сократить оставшийся пропуск до одного дня: сохранённая заморозка соединит серию. Статусы пересчитываются, поэтому ранее защищённый однодневный пропуск, который вырос сверх запаса, целиком становится `MISSED`, а запас возвращается. Пустые дни после уже прерванной серии заморозок не расходуют.

### Последние дни и подтверждение задним числом

На обзоре и в профиле показана лента семи дней с подписью и значком каждого состояния:

| Статус | Значение |
| --- | --- |
| `LOGGED` | День подтверждён реальным расходом. |
| `NO_SPEND` | Пользователь подтвердил день без трат. |
| `FROZEN` | Заморозка защитила закрытый пропущенный день. |
| `MISSED` | Закрытый день не подтверждён и не защищён. |
| `PENDING` | Сегодняшний день ещё открыт и не подтверждён. |
| `NONE` | До начала учёта: нейтральный день без подтверждения задним числом. |

Начало учёта — более ранняя из дат `startedOn` и первого подтверждённого дня. Новая установка показывает нейтральные прошлые дни, а не пропущенные обязанности; их просмотр не сохраняет историю. Сегодняшнее подтверждение доступно даже после перевода часов назад. Первая покупка, внесённая задним числом, засчитывает день создания, не открывая дни до начала учёта.

Выберите недавний неподтверждённый день, чтобы подтвердить его. Если есть реальный расход с такой датой покупки или создания, используется `LOGGED`, иначе — `NO_SPEND`. Фиктивный расход или запись с нулевой суммой не создаются. Подтверждение замороженного дня возвращает защиту через пересчёт; она может защитить другой подходящий пропуск. Подтверждение пропущенного дня также может восстановить непрерывность, если остальные дни соединяются.

Окно подтверждения — **48 фактически прошедших часов после окончания выбранного местного календарного дня, включая точную границу**. Единое действие `confirmDay` повторно проверяет доступность при сохранении и выбирает статус по реальному расходу: давно открытая страница не позволяет обойти срок. Будущие и некорректные даты и прошлые дни до начала учёта недоступны. Из-за расчёта прошедших часов местное время окончания окна может сдвинуться на час при переходе на летнее или зимнее время.

Годовой календарь активности по-прежнему показывает количество реальных записей по дате создания, а для старых записей — по дате покупки. Его показатель лучшей серии использует новую историю учёта; дни без трат и заморозки отдельно показаны в ленте семи дней.

### Сохранение, миграция и время

`StreakLedger` сохраняет только неизменяемые местные даты и подтверждения `LOGGED`/`NO_SPEND`. Запас заморозок, состояния пропусков, текущая и лучшая серии и берри вычисляются последовательным детерминированным пересчётом. Объединение дат делает одновременные подтверждения идемпотентными; для одной даты `LOGGED` имеет приоритет над `NO_SPEND`. Отдельного счётчика наград, который можно случайно увеличить дважды, нет.

При переходе существующие даты создания расходов (`createdAt`, а для старых записей — `date`) заполняют `LOGGED`. Текущая и лучшая серии и награда сохраняются без изменения. Исторические подтверждения могут дать начальный заработанный запас до двух заморозок, но старые пропуски до перехода не замораживаются задним числом. Автоматическая защита начинается со дня перехода.

Местные даты не переводятся через UTC и не переносятся на другой день после смены часового пояса. Соседство дней корректно определяется в високосные годы и при 23/25-часовых сутках. Уже сохранённые будущие подтверждения переживают перевод часов назад, но не входят в текущую статистику до повторного наступления своей даты. Долгое отсутствие обрабатывается промежутками, без сохранения отдельной строки на каждый пропущенный день.

История учёта использует **формат 3 или новее**; она появилась в версии 3. Ключ локального хранилища сохраняется; история входит в полные PDF- и JSON-копии. Версии 1 и 2 продолжают импортироваться. При добавлении записей новые подтверждённые дни объединяются; **«Восстановить всё»** намеренно заменяет историю выбранной копией. Старые вкладки, которые не понимают сохранённый формат, отказываются его перезаписывать — их нужно обновить. Обычный отчёт по расходам остаётся отчётом и не содержит восстанавливаемой истории учёта.

Профили с сохранёнными вручную курсами используют **формат 4** и ту же историю учёта. Полные PDF- и JSON-копии включают её; форматы 1–3 продолжают импортироваться. Курсы не влияют на игровые берри.

Изменённый редактор, открытый до сброса или замены истории в другой вкладке, получает отказ вместо возвращения удалённых дней. Обновление без изменений и одновременное добавление дней безопасны; реальный расход по-прежнему может заменить `NO_SPEND` на `LOGGED`.

### Реализация и проверки

| Файл | Назначение |
| --- | --- |
| `src/lib/streak/streakTypes.ts` | Формат истории, валидация и объединение дат между вкладками. |
| `src/lib/streak/streakLedger.ts` | Пересчёт, единое действие `confirmDay`, защита всего пропуска и доступность последних дней. |
| `src/lib/streak/withTrackingDays.ts`, `src/lib/appDataVersion.ts` | Подтверждения вместе с расходом одним изменением данных и выбор формата по сохранённым функциям. |
| `src/hooks/useStreakStats.ts` | Общие часы местного дня и кеш по неизменяемым расходам и истории. |
| `src/lib/streak/streakCopy.ts` | Английские и русские строки функции. |
| `src/components/StreakDays.tsx` | Доступный выбор и подтверждение недавнего дня. |
| `src/components/StreakBounty.tsx` | Ежедневное действие, запас, прогресс и постер WANTED. |
| `src/components/StreakBadge.tsx`, `src/components/ActivityCalendar.tsx` | Общая статистика учёта в навигации и профиле. |
| `src/components/StreakDays.css`, `src/components/StreakBounty.css` | Адаптивные кнопки, переменные темы и поддержка уменьшенного движения. |
| `src/hooks/useAppData.ts`, `src/hooks/usePersistentData.ts` | Атомарное сохранение; результат возвращается только из успешно записанной попытки. |
| `src/hooks/useTrackingActions.ts`, `src/hooks/useTransactions.ts`, `src/hooks/useShoppingActions.ts`, `src/hooks/useBackupRestore.ts` | Действия предметной области, подтверждения, импорт и обратная связь; App соединяет их со страницами. |
| `src/lib/finance.ts`, `src/lib/storage/storage.ts` | Валидация, сохранение и объединение истории, включая профили формата 4. |
| `src/pages/OverviewPage.tsx`, `src/pages/ProfilePage.tsx`, `src/lib/i18n.tsx`, `index.html` | Подключение страниц, локализация и раннее применение сохранённой темы. |
| `src/lib/streak/*.test.ts`, `src/hooks/useStreakStats.test.ts`, `tests/streak-browser.mjs`, `tests/run-browser.mjs`, `tests/design-browser.mjs` | Проверки движка, хранилища, PDF, миграции, интерфейса сборки и регрессий. |

Пересчёт хранит один последний снимок для неизменяемой ссылки на массив расходов и сочетания истории с местным днём. Повторный расчёт серии хранит один последний местный день на неизменяемую ссылку истории. Виджеты используют эти снимки без повторного сканирования больших массивов; новые ссылки или новый день обновляют результат. Точная доступность 48-часового окна проверяется вне кеша серии, поэтому срок истекает и внутри того же дня. Состояние приложения и снимки кеша должны оставаться неизменяемыми. Операции возвращают `{ data, result }` и публикуют обратную связь после успешной записи: неудачная попытка не выдаёт награду или сообщение об успехе.

Все модульные проверки: `npm test`. Проверки движка отдельно:

```bash
npm test -- src/lib/streak src/lib/storage/storage.test.ts src/hooks/useStreakStats.test.ts
```

Браузерные проверки производственной сборки:

```bash
GITHUB_PAGES=true npm run build
npx playwright install chromium
npm run test:browser
```

Историческая проверка релиза 2.7.0: пройдены **428 модульных тестов и 151 браузерный сценарий производственной сборки**, включая 18 сценариев новой механики учёта. Обычная сборка и сборка для GitHub Pages завершились успешно. Дополнительно проверены восемь мобильных сочетаний языка RU/EN, светлой/тёмной темы и сохранённой/прерванной серии: нарушений доступности, ошибок JavaScript и горизонтального переполнения страницы не найдено; все новые кнопки имеют размер не меньше 44 × 44 пикселей.

Текущие сценарии включают запись и день без трат, защиту всего пропуска, недостаточный запас без частичной траты, выдачу и потолок запаса, подтверждение замороженного и пропущенного дня, срок, нейтральное начало, идемпотентность, миграцию, объединение вкладок, ошибки записи, кеш по неизменяемым ссылкам, полночь, смену часового пояса и перевод часов. Данные остаются локальными в браузере; приложение доверяет часам устройства и не добавляет синхронизацию аккаунта или серверную проверку времени.

### Явные допущения

Переданный промпт начинается с середины спецификации. Подтверждённое правило семи дней закрывает отсутствующее условие получения заморозок. Остальные принятые решения: бесплатной стартовой заморозки нет; прогресс считается по всем подтверждённым дням, а не только текущей серии; запас свыше двух не копится; замороженный день не даёт берри; окно 48 часов начинается после местного окончания дня; удаление расхода не отнимает заработанный день; подтверждение учитывает реальные покупки и не создаёт финансовых записей. Существующие пользователи получают заработанный историей запас без изменения старых пропусков. Для работы этой версии нерешённых вопросов нет; экономику и сроки можно изменить в следующей версии.
