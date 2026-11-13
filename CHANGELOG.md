# Changelog

[Releases and downloadable source](https://github.com/riokoqee/belilog/releases) · [English overview](README.md) · [По-русски](README.ru.md)

## [2.11.0](https://github.com/riokoqee/belilog/releases/tag/v2.11.0) — 2026-11-13

- On a primary localStorage quota error, discard the duplicate last-good copy and retry once. A failed retry preserves the primary and reports the original error.
- Best-effort pre-replacement snapshot and a confirmed restore action for full import, reset and demo. Corrupt originals still use the existing recovery archive.
- Optional site storage usage from the browser estimate API; automatic-rate write failures now have a separate neutral message.
- Explicit **Update now** saves the profile draft, activates the waiting worker and reloads once. Open forms close; other tabs retain access to old lazy assets. Normal waiting and first installation are preserved.
- Data formats 1–5, existing storage keys and dependencies remain unchanged. Corrected the storage benchmark path.

При квоте удаляется дополнительная рабочая копия, затем основная запись повторяется один раз. Перед полной заменой сохраняется один слот отката с действием восстановления. В профиле показана доступная оценка хранилища, ошибка записи курсов отделена от сетевой.

«Обновить сейчас» сохраняет черновик профиля и перезагружает приложение один раз, закрывая формы и диалоги. Первая установка и обычное ожидание обновления сохранены. Форматы данных, существующие ключи и зависимости не меняются.

## [2.10.0](https://github.com/riokoqee/belilog/releases/tag/v2.10.0) — 2026-11-11

- Installable PWA: all pages, dialogs, fonts and PDF export are available offline after the first complete cache preparation.
- Profile controls show offline readiness, installation help and update checks. Updates wait for all app tabs to close, preserving open work.
- Optional Frankfurter reference rates for USD, EUR and KZT, with source and publication dates. Manual mode remains the default; the last successful rates remain usable offline.
- Full backups include automatic-rate settings and cached rates. Formats 1–4 still import without enabling network requests.
- CI, MIT and latest-release badges; installation instructions and this changelog.

Доступны установка и работа без сети после подготовки приложения. Автоматические курсы включаются отдельно; ручной режим остаётся исходным. Обновления применяются после закрытия всех вкладок BeliLog.

## [2.9.0](https://github.com/riokoqee/belilog/releases/tag/v2.9.0) — 2026-11-10

- Insufficient freezes no longer get spent on a gap they cannot fully protect. Days before tracking began have a neutral state.
- Day confirmation and format version selection are centralized; streak reconciliation reuses immutable data references.
- Domain hooks replace the large application component. Dialogs and hash navigation have one source of state.
- Typed translation keys, commit results returned only after successful writes, and fixes for undo and restore feedback.

## [2.8.0](https://github.com/riokoqee/belilog/releases/tag/v2.8.0) — 2026-11-09

- FinanceControl renamed to BeliLog, including the repository and GitHub Pages address.
- Configurable manual exchange rates, CSV export and full JSON backups alongside PDF.
- Short English and Russian READMEs, screenshots, MIT license and separate asset notices.

## [2.1.0](https://github.com/riokoqee/belilog/tree/v2.1.0) — 2026-10-27

- Avatar cropping, daily streaks and personal WANTED bounty posters.

## [2.0.0](https://github.com/riokoqee/belilog/tree/v2.0.0) — 2026-10-27

- BeliLog identity, itemized expenses and full PDF backups.
