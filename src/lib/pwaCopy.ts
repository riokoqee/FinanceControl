import type { Language } from "./finance";

const ru = {
  title: "Приложение",
  preparing: "Подготовка офлайн-режима…",
  ready: "Готово офлайн",
  failed: "Офлайн-копия не готова. Откройте сайт снова с интернетом.",
  unavailable: "Установка и офлайн-режим недоступны в этом браузере.",
  offline: "Без интернета",
  install: "Установить BeliLog",
  installed: "Приложение установлено",
  ios: "На iPhone и iPad: «Поделиться» → «На экран Домой».",
  check: "Проверить обновления",
  checking: "Проверяем…",
  apply: "Обновить сейчас",
  applying: "Обновление…",
  applyHint:
    "Приложение перезагрузится, открытые формы и диалоги закроются. Черновик профиля сохранится перед обновлением.",
  profileFailed: "Сохраните или исправьте черновик профиля перед обновлением.",
  applyFailed:
    "Не удалось применить обновление. Проверьте обновления и повторите попытку.",
  current: "У вас последняя версия",
  waiting:
    "Обновление готово. Закройте все вкладки BeliLog и откройте приложение снова.",
  updateFailed: "Не удалось проверить обновления. Попробуйте с интернетом.",
  hint: "Расходы хранятся в браузере. Сохраняйте резервные копии.",
};
export const pwaCopy: Record<Language, Record<keyof typeof ru, string>> = {
  ru,
  en: {
    title: "App",
    preparing: "Preparing offline access…",
    ready: "Offline ready",
    failed:
      "Offline copy is not ready. Reopen the site with an internet connection.",
    unavailable:
      "Installation and offline access are unavailable in this browser.",
    offline: "Offline",
    install: "Install BeliLog",
    installed: "App installed",
    ios: "On iPhone and iPad: Share → Add to Home Screen.",
    check: "Check for updates",
    checking: "Checking…",
    apply: "Update now",
    applying: "Updating…",
    applyHint:
      "The app will reload and open forms and dialogs will close. Your profile draft will be saved first.",
    profileFailed: "Save or correct your profile draft before updating.",
    applyFailed: "Could not apply the update. Check for updates and try again.",
    current: "You have the latest version",
    waiting: "Update ready. Close all BeliLog tabs and reopen the app.",
    updateFailed:
      "Could not check for updates. Try with an internet connection.",
    hint: "Expenses stay in this browser. Keep backup copies.",
  },
};
