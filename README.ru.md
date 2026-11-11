# BeliLog (ベリログ)

[![CI](https://github.com/riokoqee/belilog/actions/workflows/pages.yml/badge.svg)](https://github.com/riokoqee/belilog/actions/workflows/pages.yml) [![MIT](https://img.shields.io/github/license/riokoqee/belilog)](LICENSE) [![Последний релиз](https://img.shields.io/github/v/release/riokoqee/belilog)](https://github.com/riokoqee/belilog/releases/latest)

**Every Berry Counts.** Личный журнал расходов с локальным сохранением и пиратским характером.

[Открыть BeliLog](https://riokoqee.github.io/belilog/) · [English](README.md)

## Как выглядит

<table>
  <tr><th>Светлая</th><th>Тёмная</th><th>На телефоне</th></tr>
  <tr>
    <td><a href="docs/screenshots/desktop-light.png"><img src="docs/screenshots/desktop-light.png" alt="Обзор BeliLog в светлой теме" height="230" /></a></td>
    <td><a href="docs/screenshots/desktop-dark.png"><img src="docs/screenshots/desktop-dark.png" alt="Обзор BeliLog в тёмной теме" height="230" /></a></td>
    <td><a href="docs/screenshots/mobile.png"><img src="docs/screenshots/mobile.png" alt="Трекер BeliLog на экране телефона" height="230" /></a></td>
  </tr>
</table>

## Возможности

- Расходы с составом покупки, месячный бюджет и лимиты категорий.
- Список покупок с ценами, подтверждением покупки и шаблонами.
- USD, EUR и KZT: ручные курсы по умолчанию, ежедневное обновление Frankfurter по желанию.
- Установка как PWA, страницы и экспорт PDF без сети после подготовки; русский и английский, три темы.
- Дни без трат, заморозки серии и персональный постер WANTED.
- PDF-отчёты, экспорт CSV и полные резервные копии PDF/JSON.

Данные остаются в этом браузере после закрытия сайта. Аккаунта и автоматической синхронизации между устройствами нет. Перед очисткой браузера скачайте полную резервную копию.

Для установки откройте **Профиль → Приложение** или меню установки браузера. Дождитесь статуса **«Готово офлайн»** перед отключением сети. Обновления применяются после закрытия всех вкладок BeliLog и повторного открытия.

## Локальный запуск

Нужен Node.js 22.12+ или 24 LTS.

```bash
npm ci
npm run dev
```

Сборка и модульные тесты:

```bash
npm run build
npm test
```

React 19 · TypeScript · Vite. Статический сайт на GitHub Pages.

## Документация

- [Подробное руководство](docs/USAGE.ru.md)
- [История изменений](CHANGELOG.md) и [релизы](https://github.com/riokoqee/belilog/releases)
- [Разработка, браузерные тесты и публикация](docs/DEVELOPMENT.md)
- [Серии и заморозки](docs/STREAKS.md)
- [Дизайн](docs/DESIGN_REDESIGN.md) и [производительность](docs/PERFORMANCE.md)
- [Источники изображений и лицензии](docs/ASSETS.md)

## Лицензия

Код приложения: [MIT](LICENSE). Изображения, шрифты и уведомления зависимостей перечислены отдельно в [ASSETS.md](docs/ASSETS.md).
