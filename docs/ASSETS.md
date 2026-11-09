# Asset sources and notices

## English

The application source uses the [MIT license](../LICENSE). This inventory records artwork provenance separately from the font, dependency and code notices.

On **9 November 2026**, the project owner confirmed in the project discussion that they hold the rights to the current artwork and asked to keep it: «Оставить текущую — права у меня есть». The current hat artwork is retained on that basis. The confirmation is recorded here; the original artist, source URL and specific artwork license have not been independently recorded.

### Straw-hat artwork

| Files | Repository evidence | Source status |
| --- | --- | --- |
| `assets/Iconic Red-Banded Straw Hat.png`, `public/straw-hat.png` | Identical SHA-256; 1536×1024 PNG. The project history describes the artwork as supplied in `assets/`. | Original creator, source URL and artwork license are not recorded. No author/license text was found in PNG text chunks. |
| `assets/belilog-strawhat-logo.png` | Prepared 1038×1038 PNG, introduced with the BeliLog artwork. | No separate origin or license record. |
| `assets/belilog-icon-512.png`, `public/belilog-icon-512.png` | Identical SHA-256; prepared 512×512 PNG used by the current brand and posters. | No separate origin or license record. |
| `assets/belilog-favicon.ico`, `public/favicon.ico` | Identical SHA-256; 16/32/48/64px icon variants, used by the browser. | No separate origin or license record. |
| `public/favicon.svg` | SVG paths defined in the repository; the current HTML selects the ICO instead. | No separate upstream attribution or artwork license found. |

The table describes the available file metadata alongside the owner's confirmation above. No replacement artist, source URL or artwork license has been inferred.

### Fonts and interface icons

| Asset | Verified local metadata | Included notice |
| --- | --- | --- |
| Manrope Variable | Imported from `@fontsource-variable/manrope` 5.2.8; package metadata identifies Manrope and `OFL-1.1`. Served as bundled files. | [OFL-Manrope.txt](../public/fonts/OFL-Manrope.txt), naming the Manrope Project Authors. |
| `public/fonts/belilog-jp.woff2` | Font metadata identifies Noto Sans JP Medium; the app uses a local subset for ベリログ. | [OFL-NotoSansJP.txt](../public/fonts/OFL-NotoSansJP.txt), with the Adobe copyright notice. |
| `public/fonts/report-font.ttf` | Font metadata identifies DejaVu Sans Book; used by PDF generation. | [report-font.LICENSE.txt](../public/fonts/report-font.LICENSE.txt), carrying Bitstream Vera terms and DejaVu notices. |
| Lucide React | Installed package metadata identifies `lucide-react` 0.468.0 and ISC; its notice also credits Feather portions. | The dependency's `LICENSE` is included in its installed package; version is pinned by `package-lock.json`. |

WANTED paper, seals, charts and interface decorations are implemented in SVG/CSS/React source. No separate raster texture is loaded for them. The project uses One Piece-inspired names, a straw-hat identity, MARINE lettering and fictional berries. No official affiliation is specified in the repository.

The three images in `docs/screenshots/` are Playwright captures of the actual app demo: 16 sample expenses, a fixed 9 November 2026 clock, desktop light/dark overviews and a mobile tracker. They contain demo values rather than a user's financial history.

### Remaining provenance work

- Add the original hat illustration's creator, source and specific terms behind the owner's confirmation when available.
- Keep font and dependency notices separate from any application code license.

## Русский

Код приложения распространяется по [лицензии MIT](../LICENSE). Происхождение изображений описано отдельно от уведомлений шрифтов, зависимостей и кода.

**9 ноября 2026 года** владелец проекта подтвердил в обсуждении права на текущие изображения и попросил сохранить их: «Оставить текущую — права у меня есть». Текущая шляпа сохранена на основании этого подтверждения. Автор исходной иллюстрации, ссылка на источник и конкретная лицензия изображения пока не записаны независимо от подтверждения владельца.

### Изображение шляпы

`assets/Iconic Red-Banded Straw Hat.png` и `public/straw-hat.png` совпадают побайтно. История проекта описывает изображение как предоставленное в папке `assets/`, но автор, ссылка на источник и лицензия иллюстрации не записаны. Текстовых PNG-метаданных с автором или лицензией не найдено.

Для подготовленных `belilog-strawhat-logo.png`, PNG-иконки 512×512 и ICO также нет отдельной записи о происхождении или условиях использования. Копии PNG/ICO в `assets/` и `public/` совпадают. `public/favicon.svg` содержит SVG-контуры в исходниках; действующий HTML подключает ICO. Источник или отдельная лицензия SVG не указаны.

### Шрифты и иконки

- **Manrope Variable:** пакет `@fontsource-variable/manrope` 5.2.8, локальные файлы. Метаданные пакета указывают `OFL-1.1`; текст — [OFL-Manrope.txt](../public/fonts/OFL-Manrope.txt).
- **Noto Sans JP Medium:** семейство подтверждено метаданными `belilog-jp.woff2`, используется локальный поднабор для ベリログ. Приложен [OFL-NotoSansJP.txt](../public/fonts/OFL-NotoSansJP.txt) с уведомлением Adobe.
- **DejaVu Sans Book:** семейство подтверждено метаданными `report-font.ttf`, применяется в PDF. Условия Bitstream Vera и уведомления DejaVu находятся в [report-font.LICENSE.txt](../public/fonts/report-font.LICENSE.txt).
- **Lucide React:** метаданные установленного пакета 0.468.0 указывают ISC; его `LICENSE` также отмечает части Feather. Версия зафиксирована в `package-lock.json`.

Пергамент WANTED, печати, графики и декор описаны SVG/CSS/React-кодом; отдельные растровые текстуры для них не загружаются. В проекте есть отсылки к One Piece, шляпа, надпись MARINE и игровые берри. Официальная связь с франшизой в репозитории не заявлена.

Три изображения в `docs/screenshots/` сняты Playwright с настоящего демо приложения: 16 примерных расходов, часы зафиксированы на 9 ноября 2026 года, обзор в обеих темах и трекер на телефоне. Личные финансовые данные пользователя не использовались.

Когда сведения будут доступны, к подтверждению владельца можно добавить автора, источник и конкретные условия использования исходной шляпы. Уведомления шрифтов и зависимостей хранятся отдельно от лицензии кода приложения.
