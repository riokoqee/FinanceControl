export const settingsCopy = {
  ru: {
    rates: "Курсы валют",
    ratesHint: "Исходные суммы расходов сохраняются.",
    rateMode: "Обновление курсов",
    manualMode: "Вручную",
    automaticMode: "Автоматически · Frankfurter",
    automaticHint:
      "Справочные курсы Frankfurter. Обновление раз в день при открытии или возвращении в приложение. Запрос отправляет только названия валют.",
    refreshRates: "Обновить курсы",
    refreshingRates: "Обновление…",
    awaitingRates:
      "Курсы ещё не загружены. Пока используются сохранённые значения.",
    providerDates: "Дата курса",
    checkedRates: "Проверено",
    cancelBeforeMode: "Сохраните или отмените изменения, чтобы сменить режим.",
    rateDraftConflict:
      "Настройки изменились в другой вкладке. Отмените черновик, чтобы увидеть сохранённые курсы.",
    offlineRates: "Нет сети. Сохранённые курсы доступны офлайн.",
    timeoutRates: "Источник не ответил вовремя. Сохранённые курсы не изменены.",
    invalidFeed:
      "Источник вернул некорректные курсы. Сохранённые значения не изменены.",
    networkRates:
      "Не удалось обновить курсы. Сохранённые значения не изменены.",
    storageRates:
      "Новые курсы получены, но не сохранены в браузере. Используются прежние значения.",
    conflictRates:
      "Настройки курсов изменились. Проверьте их и повторите обновление.",
    estimates: "Пока используются примерные значения.",
    eur: "1 USD в EUR",
    kzt: "1 USD в KZT",
    saveRates: "Сохранить курсы",
    cancel: "Отменить изменения",
    invalidRates:
      "Введите оба курса: от 0,000001 до 1 000 000, до 6 знаков после запятой.",
    ratesFailed:
      "Курсы не сохранены. Проверьте сообщение об ошибке и повторите попытку.",
    ratesSaved: "Курсы сохранены",
    localData: "Данные только в этом браузере. Для переноса скачайте копию.",
    jsonBackup: "JSON-копия всех данных",
    csvReport: "Расходы в CSV",
  },
  en: {
    rates: "Exchange rates",
    ratesHint: "Original expense amounts are preserved.",
    rateMode: "Rate updates",
    manualMode: "Manual",
    automaticMode: "Automatic · Frankfurter",
    automaticHint:
      "Frankfurter reference rates. Updates once a day when you open or return to the app. Requests contain only currency codes.",
    refreshRates: "Refresh rates",
    refreshingRates: "Refreshing…",
    awaitingRates: "Rates have not loaded yet. Saved values remain in use.",
    providerDates: "Rate date",
    checkedRates: "Checked",
    cancelBeforeMode: "Save or cancel your changes before switching modes.",
    rateDraftConflict:
      "Settings changed in another tab. Cancel your draft to see saved rates.",
    offlineRates: "You are offline. Saved rates remain available.",
    timeoutRates: "The source timed out. Saved rates have not changed.",
    invalidFeed:
      "The source returned invalid rates. Saved values have not changed.",
    networkRates: "Rates could not be updated. Saved values have not changed.",
    storageRates:
      "New rates were received but could not be saved in this browser. Previous values remain in use.",
    conflictRates:
      "Rate settings have changed. Check them and try refreshing again.",
    estimates: "Illustrative values are currently in use.",
    eur: "1 USD in EUR",
    kzt: "1 USD in KZT",
    saveRates: "Save rates",
    cancel: "Cancel changes",
    invalidRates:
      "Enter both rates: 0.000001 to 1,000,000, with up to 6 decimal places.",
    ratesFailed: "Rates were not saved. Check the error message and try again.",
    ratesSaved: "Rates saved",
    localData: "Data stays in this browser. Download a backup to move it.",
    jsonBackup: "JSON backup of all data",
    csvReport: "Expenses as CSV",
  },
} as const;
