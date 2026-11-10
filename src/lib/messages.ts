import type { Language } from "./finance";

/** Stable identifiers: editing interface wording never changes a translation key. */
export const russian = {
  "ui.deletesAllBelilogDataFromThisBrowser":
    "Удаляет все данные BeliLog из этого браузера.",
  "ui.categoryLimits": "Лимиты категорий",
  "ui.limits": "Лимиты",
  "ui.templates": "Шаблоны",
  "ui.limitsSaved": "Лимиты сохранены",
  "ui.templateSaved": "Шаблон сохранён",
  "ui.templateAddedToTheList": "Шаблон добавлен в список",
  "ui.templateDeleted": "Шаблон удалён",
  "ui.youCanSaveUpTo20Templates": "Можно сохранить не больше 20 шаблонов.",
  "ui.aTemplateMustContain1200Items":
    "В шаблоне должно быть от 1 до 200 товаров.",
  "ui.theTemplateWasDeletedOpenTheCurrentList":
    "Шаблон удалён. Откройте актуальный список.",
  "ui.restoreEverythingReplacesAllBelilogDataWithThisBackup":
    "Восстановить всё заменит все данные BeliLog содержимым копии.",
  "ui.allBelilogDataWillBeRemovedFromThisBrowserYouCanDownloadABackupFirst":
    "Все данные BeliLog будут удалены из этого браузера. Перед удалением можно скачать резервную копию.",
  "ui.theDemoReplacesAllBelilogDataDownloadABackupToReturnToYourData":
    "Демо заменит все данные BeliLog. Скачайте копию, чтобы вернуться к своим данным.",
  "ui.autosave": "Автосохранение",
  "ui.data": "Данные",
  "ui.bestStreak": "Лучшая серия",
  "ui.noExpensesYet": "Пока нет расходов",
  "ui.appearance": "Тема оформления",
  "ui.oneBudgetForEveryMonth": "Один лимит для всех месяцев.",
  "ui.loading": "Загрузка…",
  "ui.reloadPage": "Обновить страницу",
  "ui.thisSectionCouldNotLoadCheckYourConnectionAndReloadThePage":
    "Не удалось загрузить раздел. Проверьте соединение и обновите страницу.",
  "ui.purchaseConfirmedExpenseSaved": "Покупка подтверждена. Расход сохранён.",
  "ui.loadCurrentProfile": "Загрузить актуальный профиль",
  "ui.theConvertedBudgetExceedsTheLimitReduceYourBudgetBeforeChangingCurrency":
    "После смены валюты бюджет превышает допустимый максимум. Сначала уменьшите бюджет.",
  "ui.damagedDataDetectedTheOriginalCopyIsPreserved":
    "Обнаружены повреждённые данные. Исходная копия сохранена.",
  "ui.autosaveIsPausedRestoreABackupOrStartAgain":
    "Автосохранение приостановлено. Восстановите копию или начните заново.",
  "ui.theChangeWasNotAppliedCheckAvailableSpaceAndBrowserStorageAccess":
    "Изменение не применено. Проверьте свободное место и доступ к хранилищу.",
  "ui.restoreLastGoodCopy": "Восстановить последнюю копию",
  "ui.restoreTheLastGoodCopy": "Восстановить последнюю копию?",
  "ui.theDamagedDataWillBeArchivedSeparatelyYourWorkingCopyWillBeEditableAgain":
    "Повреждённые данные будут сохранены отдельно. Рабочая копия снова станет доступна для изменений.",
  "ui.restoreBackup": "Восстановить копию",
  "ui.loadCurrentEntry": "Загрузить актуальную запись",
  "ui.changesWereNotSavedCheckTheCurrentDataAndTryAgain":
    "Изменения не сохранены. Проверьте актуальные данные и попробуйте ещё раз.",
  "ui.thisItemChangedInAnotherTabCancelEditingAndOpenItAgain":
    "Покупка изменена в другой вкладке. Отмените редактирование и откройте её заново.",
  "ui.savedDataIsDamagedTheOriginalCopyIsPreservedRestoreABackupOrConfirmAReset":
    "Сохранённые данные повреждены. Исходная копия сохранена. Восстановите резервную копию или подтвердите сброс.",
  "ui.dataChangedInAnotherTabLoadTheCurrentEntryAndTryAgain":
    "Данные изменились в другой вкладке. Обновите запись и повторите изменение.",
  "ui.browserStorageIsUnavailable": "Хранилище браузера недоступно.",
  "nav.shopping": "Список покупок",
  "nav.tracker": "Трекер",
  "nav.profile": "Профиль",
  "ui.theShoppingListCanContainUpTo1000Products":
    "В списке покупок может быть не больше 1000 товаров.",
  "ui.chooseUsdEurOrKzt": "Выберите валюту USD, EUR или KZT.",
  "ui.thePriceCannotBeLowerThanTheExpenseSItemTotal":
    "Цена не может быть меньше суммы покупок внутри расхода.",
  "ui.theLimitOf50000ExpensesHasBeenReached":
    "Достигнут предел в 50 000 расходов.",
  "ui.thisProductIsNoLongerInTheShoppingList":
    "Товар не найден в списке покупок.",
  "ui.enterAPositivePriceUpTo1000000000000WithUpToTwoDecimalPlaces":
    "Введите положительную цену до 1 000 000 000 000 с точностью до двух знаков.",
  "ui.editAvatar": "Редактировать аватар",
  "ui.avatarEditor": "Редактор аватара",
  "ui.userAvatar": "Аватар пользователя",
  "ui.chooseAvatar": "Выбрать аватар",
  "nav.overview": "Обзор",
  "ui.expenseTracker": "Трекер расходов",
  "ui.myProfile": "Мой профиль",
  "ui.changesSaved": "Изменения сохранены",
  "ui.expenseAddedEverythingIsUnderControl":
    "Расход добавлен. Всё под контролем!",
  "ui.expenseDeleted": "Расход удалён",
  "ui.expenseRestored": "Расход восстановлен",
  "ui.date": "Дата",
  "ui.title": "Название",
  "ui.amount": "Сумма",
  "ui.currency": "Валюта",
  "ui.category": "Категория",
  "ui.note": "Заметка",
  "ui.backupImportedDuplicatesWereSkipped":
    "Копия импортирована. Дубликаты пропущены.",
  "ui.demoLoadedYouCanEditOrDeleteAnyRecord":
    "Демо загружено. Можно редактировать и удалять любые записи.",
  "ui.actions": "Действия",
  "common.edit": "Изменить",
  "common.delete": "Удалить",
  "ui.noResultsFound": "Ничего не нашлось",
  "ui.tryADifferentTitleOrChangeTheFilters":
    "Попробуйте другое название или измените фильтры.",
  "ui.resetFilters": "Сбросить фильтры",
  "ui.addExpense": "Добавить расход",
  "ui.mainNavigation": "Основная навигация",
  "ui.savedOnThisDevice": "Сохранено на устройстве",
  "ui.unableToSave": "Не удалось сохранить",
  "ui.switchTheme": "Переключить тему",
  "ui.openProfile": "Открыть профиль",
  "ui.u": "П",
  "error.saveFailed": "Не удалось сохранить изменения в браузере.",
  "ui.downloadBackup": "Скачать копию",
  "ui.everythingUnderControl": "Всё под контролем",
  "ui.previousMonth": "Предыдущий месяц",
  "ui.chooseMonth": "Выбрать месяц",
  "ui.nextMonth": "Следующий месяц",
  "ui.overviewCurrency": "Валюта обзора",
  "ui.exploreDemo": "Посмотреть демо",
  "ui.dismissTip": "Скрыть подсказку",
  "ui.monthlySpending": "Расходы за месяц",
  "ui.comparedWithLastMonth": "к прошлому месяцу",
  "ui.record": "запись",
  "ui.records": "записи",
  "ui.recordsAlternative": "записей",
  "ui.budgetRemaining": "Осталось в бюджете",
  "ui.monthlyBudget": "Месячный бюджет",
  "ui.notSet": "Не задан",
  "ui.used": "% использовано",
  "ui.setAComfortableLimit": "Задать комфортный лимит",
  "ui.dailyAverage": "В среднем за день",
  "ui.day": "день",
  "ui.days": "дня",
  "ui.daysAlternative": "дней",
  "ui.over": "За",
  "ui.thisMonthAlternative": "месяца",
  "ui.thisMonthHasNotStartedYet": "Месяц ещё не начался",
  "ui.spendingOverTime": "Динамика расходов",
  "ui.7Days": "7 дней",
  "ui.month": "Месяц",
  "ui.spending": "Расходы",
  "ui.last7DaysOfTheSelectedMonth": "Последние 7 дней выбранного месяца",
  "ui.whereYourMoneyGoes": "Куда уходят деньги",
  "ui.spendingBreakdownByCategory": "Распределение расходов по категориям",
  "ui.noCategorySpendingYet": "Пока нет расходов по категориям",
  "ui.categoryAlternative": "категория",
  "ui.categories": "категории",
  "ui.categoriesAlternative": "категорий",
  "ui.aFreshStart": "Всё впереди",
  "ui.more": "Ещё",
  "ui.recentExpenses": "Последние расходы",
  "ui.allExpenses": "Все расходы",
  "ui.of": "от",
  "ui.overBudgetBy": "Лимит превышен на",
  "ui.remaining": "В запасе",
  "ui.adjustBudget": "Настроить бюджет",
  "ui.setBudget": "Установить бюджет",
  "ui.ofAllTime": "за всё время",
  "ui.forTheSelectedMonth": "за выбранный месяц",
  "ui.numberOfRecords": "Количество записей",
  "ui.findAPurchaseOrNote": "Найти покупку или заметку…",
  "ui.searchExpenses": "Поиск расходов",
  "ui.clearSearch": "Очистить поиск",
  "ui.filterByCategory": "Фильтр по категории",
  "ui.allCategories": "Все категории",
  "ui.filterByCurrency": "Фильтр по валюте",
  "ui.allCurrencies": "Все валюты",
  "ui.sortExpenses": "Сортировка расходов",
  "ui.newestFirst": "Сначала новые",
  "ui.oldestFirst": "Сначала старые",
  "ui.amountAlternative": "По сумме ↓",
  "ui.allTime": "За всё время",
  "ui.storageIsUnavailableDownloadABackup":
    "Хранилище недоступно. Скачайте резервную копию.",
  "ui.profileSettingsSaved": "Настройки профиля сохранены",
  "ui.personalSettings": "Личные настройки",
  "ui.whatShouldWeCallYou": "Как к вам обращаться",
  "ui.yourName": "Ваше имя",
  "ui.optional": "необязательно",
  "ui.mainCurrency": "Основная валюта",
  "ui.monthlyBudgetAlternative": "Бюджет на месяц",
  "theme.light": "Светлая",
  "theme.dark": "Тёмная",
  "ui.system": "Как в системе",
  "ui.saveSettings": "Сохранить настройки",
  "ui.totalRecords": "Всего записей",
  "ui.dataSize": "Размер данных",
  "ui.kb": "КБ",
  "ui.status": "Состояние",
  "ui.saved": "Сохранено",
  "ui.saveFailed": "Ошибка сохранения",
  "ui.importBackup": "Импортировать копию",
  "ui.tryAnExample": "Попробовать на примере",
  "ui.loadDemo": "Загрузить демо",
  "ui.deleteAllData": "Удалить все данные",
  "ui.startFresh": "Начать с чистого листа?",
  "ui.loadDemoAlternative": "Загрузить демо?",
  "common.close": "Закрыть",
  "ui.downloadABackupFirst": "Скачать копию перед заменой",
  "common.cancel": "Отмена",
  "ui.dataDeletedYouCanStartFresh": "Данные удалены. Можно начать заново.",
  "ui.undo": "Вернуть",
  "ui.dismissNotification": "Закрыть уведомление",
  "ui.dailySpending": "Расходы по дням,",
  "ui.manageExpenses": "Управление расходами",
  "ui.enterATitleAValidDateAndAnAmountOfAtLeast001":
    "Укажите название, корректную дату и сумму не меньше 0,01.",
  "ui.editExpense": "Изменить расход",
  "ui.newExpense": "Новый расход",
  "ui.whatDidYouSpendOn": "На что потратили?",
  "ui.forExampleCoffeeAndACroissant": "Например, кофе и круассан",
  "ui.purchaseDate": "Дата покупки",
  "common.save": "Сохранить",
  "category.food": "Еда и продукты",
  "category.shopping": "Покупки",
  "category.transport": "Транспорт",
  "category.home": "Дом",
  "category.entertainment": "Развлечения",
  "category.health": "Здоровье",
  "category.other": "Другое",
  "currency.usd": "Доллар США",
  "currency.eur": "Евро",
  "currency.kzt": "Казахстанский тенге",
  "ui.interfaceLanguage": "Язык интерфейса",
  "ui.russian": "Русский",
  "ui.english": "Английский",
  "ui.towardsYourTreasure": "Навстречу своим сокровищам",
  "ui.belilogHome": "BeliLog — главная",
  "ui.openRecord": "Открыть запись",
  "ui.changeAvatar": "Сменить аватар",
  "ui.removeAvatar": "Удалить аватар",
  "ui.avatarSaved": "Аватар сохранён",
  "ui.createPdf": "Создать PDF",
  "ui.pdfBackupWithAllYourData": "PDF-копия со всеми данными",
  "ui.importPdfBackup": "Импортировать PDF-копию",
  "ui.backupVerified": "Копия проверена",
  "ui.chooseHowToRestoreYourDataYouCanMergeYourCurrentRecordsWithTheBackup":
    "Выберите, как восстановить данные. Текущие записи можно объединить с копией.",
  "ui.restoreEverything": "Восстановить всё",
  "ui.addRecords": "Добавить записи",
  "ui.backupRestored": "Копия восстановлена",
  "ui.theTotalIsLowerThanTheItemizedPurchasesUpdateTheItemsFirst":
    "Общая сумма меньше суммы покупок внутри записи. Сначала измените состав.",
  "ui.user": "Пользователь",
  "ui.activityCalendar": "Календарь активности",
  "ui.previousYear": "Предыдущий год",
  "ui.nextYear": "Следующий год",
  "ui.dailyActivity": "Активность по дням",
  "ui.less": "Меньше",
  "ui.moreAlternative": "Больше",
  "ui.activeDays": "активных дней",
  "ui.theItemTotalCannotExceedTheRecordAmount":
    "Сумма покупок не может превышать общую сумму записи.",
  "ui.enterATitleAndAnAmountOfAtLeast001":
    "Укажите название и сумму не меньше 0,01.",
  "ui.aRecordCanContainUpTo200Items":
    "В одной записи может быть не больше 200 покупок.",
  "ui.whatYouBought": "Что было в покупке",
  "ui.itemName": "Название покупки",
  "ui.forExampleBread": "Например, батон",
  "common.add": "Добавить",
  "ui.itemized": "Расшифровано",
  "ui.leftToItemize": "Осталось расшифровать",
  "ui.editRecord": "Изменить запись",
  "common.done": "Готово",
  "ui.saveItem": "Сохранить покупку",
  "ui.editItem": "Изменить покупку",
  "ui.deleteItem": "Удалить покупку",
  "ui.startAgain": "Начать заново",
  "ui.theBackupFileIsTooLarge": "Файл резервной копии слишком большой.",
  "ui.couldNotReadJsonChooseABelilogBackup":
    "Не удалось прочитать JSON. Выберите резервную копию BeliLog.",
  "ui.unsupportedBackupFormat": "Неподдерживаемый формат резервной копии.",
  "ui.theBackupContainsInvalidProfileSettings":
    "Настройки профиля в резервной копии некорректны.",
  "ui.theBackupContainsAnInvalidExpenseList":
    "Некорректный список расходов в резервной копии.",
  "ui.anExpenseContainsAnInvalidAmountCurrencyCategoryOrDate":
    "Один из расходов содержит некорректную сумму, валюту, категорию или дату.",
  "ui.theBackupContainsDuplicateExpenseIds":
    "В резервной копии найдены повторяющиеся ID расходов.",
  "ui.invalidExpenseCreationDate": "Некорректная дата создания расхода.",
  "ui.anExpenseCanContainUpTo200Items":
    "В одном расходе может быть не больше 200 покупок.",
  "ui.anItemContainsAnInvalidAmount":
    "Одна из покупок содержит некорректную сумму.",
  "ui.theExpenseContainsDuplicateItemIds":
    "В расходе найдены повторяющиеся ID покупок.",
  "ui.theItemTotalExceedsTheExpenseAmount":
    "Сумма покупок превышает общую сумму расхода.",
  "ui.anItemContainsAnInvalidCurrencyOrCreationDate":
    "Один из товаров содержит некорректную валюту или дату создания.",
  "ui.theShoppingListContainsDuplicateItemIds":
    "В списке покупок найдены повторяющиеся ID товаров.",
  "ui.anExpenseCannotBeLinkedToMultipleShoppingItems":
    "Один расход не может быть связан с несколькими товарами.",
  "ui.invalidCategoryBudgetList": "Некорректный список лимитов по категориям.",
  "ui.aBudgetContainsAnInvalidCategoryCurrencyOrAmount":
    "Один из лимитов содержит некорректную категорию, валюту или сумму.",
  "ui.theBackupContainsDuplicateCategoryBudgets":
    "В резервной копии найдены повторяющиеся лимиты категорий.",
  "ui.youCanSaveUpTo20ShoppingTemplates":
    "Можно сохранить не больше 20 шаблонов покупок.",
  "ui.theBackupContainsDuplicateTemplateIds":
    "В резервной копии найдены повторяющиеся ID шаблонов.",
  "ui.invalidItemCurrencyInTheTemplate":
    "Некорректная валюта товара в шаблоне.",
  "ui.couldNotLoadThePdfFontPleaseTryAgain":
    "Не удалось загрузить шрифт для PDF. Попробуйте ещё раз.",
  "ui.thePdfIsTooLargeTheLimitIs40Mb": "PDF слишком большой. Максимум — 40 МБ.",
  "ui.chooseAPdfSavedByBelilog": "Выберите PDF, сохранённый из BeliLog.",
  "ui.couldNotReadThePdfChooseABelilogBackup":
    "Не удалось прочитать PDF. Выберите резервную копию BeliLog.",
  "ui.thisPdfDoesNotContainABelilogBackup":
    "В этом PDF нет резервной копии BeliLog.",
  "ui.invalidPdfAttachmentTree": "Некорректное дерево вложений PDF.",
  "ui.theBackupEmbeddedInThisPdfIsDamaged":
    "Вложенная резервная копия PDF повреждена.",
  "ui.theEmbeddedBackupIsTooLarge":
    "Вложенная резервная копия слишком большая.",
  "ui.invalidShoppingItemCreationDate": "Некорректная дата создания товара.",
  "ui.thisExpenseIsAlreadyLinkedToAnotherShoppingItem":
    "Этот расход уже связан с другим товаром.",
  "ui.anItemWithThisIdIsAlreadyInTheShoppingList":
    "Товар с таким ID уже есть в списке покупок.",
  "ui.anExpenseWithThisIdAlreadyExists": "Расход с таким ID уже существует.",
  "ui.invalidFieldFieldInTheBackup":
    "Некорректное поле «{field}» в резервной копии.",
  "ui.fieldFieldCannotBeEmpty": "Поле «{field}» не может быть пустым.",
  "ui.invalidFieldField": "Некорректное поле «{field}».",
  "ui.theJournalCanContainUpToCountEntries":
    "В журнале может быть не больше {count} записей.",
  "ui.theShoppingListCanContainUpToCountItems":
    "В списке покупок может быть не больше {count} товаров.",
  "ui.theBackupContainsInvalidCheckInHistory":
    "Некорректная история дней учёта в резервной копии.",
  "streak.newRank": "Новый пиратский ранг",
  "ui.exchangeRatesAreInvalidEnterPositiveValuesFrom0000001To1000000WithAtMost6DecimalPlacesTheUsdBaseRateMustBe1":
    "Курсы валют некорректны. Укажите положительные значения от 0,000001 до 1 000 000, не более 6 знаков после запятой; базовый курс USD должен равняться 1.",
  "ui.useUpAndDownToMoveOneDayLeftAndRightToMoveOneWeekHomeAndEndMoveToTheFirstAndLastDayOfTheWeekControlPlusHomeOrEndMovesToTheStartOrEndOfTheYearPressEnterOrSpaceToSelectADay":
    "Стрелки вверх и вниз перемещают на день, влево и вправо — на неделю. Home и End переходят к началу и концу недели; Control с Home или End — к началу или концу года. Нажмите Enter или пробел, чтобы выбрать день.",
  "ui.byDateAddedOlderRecordsUseThePurchaseDate":
    "По дате добавления; старые записи — по дате покупки.",
  "ui.limitReached": "Лимит использован",
  "ui.overLimit": "Перерасход",
  "ui.nearLimit": "Близко к лимиту",
  "ui.onTrack": "В норме",
  "ui.enterAValidAmountUpTo2DecimalPlaces":
    "укажите сумму, не более 2 знаков после запятой.",
  "ui.couldNotSaveReloadCurrentLimitsAndTryAgain":
    "Не удалось сохранить. Загрузите актуальные лимиты и повторите.",
  "ui.perMonthLeaveBlankOrEnter0ForNoLimit":
    "На месяц. Пусто или 0 — без лимита.",
  "ui.noLimit": "Без лимита",
  "ui.reloadCurrentLimits": "Загрузить актуальные лимиты",
  "ui.useLeftAndRightArrowKeysToChooseADayHomeForTheFirstDayAndEndForTheLastDayYouCanAlsoChooseADayFromTheListBelowTheChart":
    "Выбирайте день стрелками влево и вправо, Home — первый день, End — последний. Также можно выбрать день в списке под графиком.",
  "ui.dayAlternative": "День",
  "ui.expenseHistoryPages": "Страницы журнала расходов",
  "ui.previousPage": "Предыдущая страница",
  "ui.nextPage": "Следующая страница",
  "ui.monthlyLimit": "лимит на месяц",
  "ui.overBy": "Сверх ",
  "field.expenseId": "ID расхода",
  "field.expenseTitle": "Название расхода",
  "field.note": "Заметка",
  "field.purchaseId": "ID покупки",
  "field.purchaseTitle": "Название покупки",
  "field.shoppingItemId": "ID товара",
  "field.shoppingItemTitle": "Название товара",
  "field.linkedExpenseId": "ID связанного расхода",
  "field.templateId": "ID шаблона",
  "field.templateName": "Название шаблона",
  "field.name": "Имя",
  "field.email": "Электронная почта",
} as const;

export type MessageKey = keyof typeof russian;
export const english = {
  "ui.deletesAllBelilogDataFromThisBrowser":
    "Deletes all BeliLog data from this browser.",
  "ui.categoryLimits": "Category limits",
  "ui.limits": "Limits",
  "ui.templates": "Templates",
  "ui.limitsSaved": "Limits saved",
  "ui.templateSaved": "Template saved",
  "ui.templateAddedToTheList": "Template added to the list",
  "ui.templateDeleted": "Template deleted",
  "ui.youCanSaveUpTo20Templates": "You can save up to 20 templates.",
  "ui.aTemplateMustContain1200Items": "A template must contain 1–200 items.",
  "ui.theTemplateWasDeletedOpenTheCurrentList":
    "The template was deleted. Open the current list.",
  "ui.restoreEverythingReplacesAllBelilogDataWithThisBackup":
    "Restore everything replaces all BeliLog data with this backup.",
  "ui.allBelilogDataWillBeRemovedFromThisBrowserYouCanDownloadABackupFirst":
    "All BeliLog data will be removed from this browser. You can download a backup first.",
  "ui.theDemoReplacesAllBelilogDataDownloadABackupToReturnToYourData":
    "The demo replaces all BeliLog data. Download a backup to return to your data.",
  "ui.autosave": "Autosave",
  "ui.data": "Data",
  "ui.bestStreak": "Best streak",
  "ui.noExpensesYet": "No expenses yet",
  "ui.appearance": "Appearance",
  "ui.oneBudgetForEveryMonth": "One budget for every month.",
  "ui.loading": "Loading…",
  "ui.reloadPage": "Reload page",
  "ui.thisSectionCouldNotLoadCheckYourConnectionAndReloadThePage":
    "This section could not load. Check your connection and reload the page.",
  "ui.purchaseConfirmedExpenseSaved": "Purchase confirmed. Expense saved.",
  "ui.loadCurrentProfile": "Load current profile",
  "ui.theConvertedBudgetExceedsTheLimitReduceYourBudgetBeforeChangingCurrency":
    "The converted budget exceeds the limit. Reduce your budget before changing currency.",
  "ui.damagedDataDetectedTheOriginalCopyIsPreserved":
    "Damaged data detected. The original copy is preserved.",
  "ui.autosaveIsPausedRestoreABackupOrStartAgain":
    "Autosave is paused. Restore a backup or start again.",
  "ui.theChangeWasNotAppliedCheckAvailableSpaceAndBrowserStorageAccess":
    "The change was not applied. Check available space and browser storage access.",
  "ui.restoreLastGoodCopy": "Restore last good copy",
  "ui.restoreTheLastGoodCopy": "Restore the last good copy?",
  "ui.theDamagedDataWillBeArchivedSeparatelyYourWorkingCopyWillBeEditableAgain":
    "The damaged data will be archived separately. Your working copy will be editable again.",
  "ui.restoreBackup": "Restore backup",
  "ui.loadCurrentEntry": "Load current entry",
  "ui.changesWereNotSavedCheckTheCurrentDataAndTryAgain":
    "Changes were not saved. Check the current data and try again.",
  "ui.thisItemChangedInAnotherTabCancelEditingAndOpenItAgain":
    "This item changed in another tab. Cancel editing and open it again.",
  "ui.savedDataIsDamagedTheOriginalCopyIsPreservedRestoreABackupOrConfirmAReset":
    "Saved data is damaged. The original copy is preserved. Restore a backup or confirm a reset.",
  "ui.dataChangedInAnotherTabLoadTheCurrentEntryAndTryAgain":
    "Data changed in another tab. Load the current entry and try again.",
  "ui.browserStorageIsUnavailable": "Browser storage is unavailable.",
  "nav.shopping": "Shopping list",
  "nav.tracker": "Tracker",
  "nav.profile": "Profile",
  "ui.theShoppingListCanContainUpTo1000Products":
    "The shopping list can contain up to 1,000 products.",
  "ui.chooseUsdEurOrKzt": "Choose USD, EUR or KZT.",
  "ui.thePriceCannotBeLowerThanTheExpenseSItemTotal":
    "The price cannot be lower than the expense’s item total.",
  "ui.theLimitOf50000ExpensesHasBeenReached":
    "The limit of 50,000 expenses has been reached.",
  "ui.thisProductIsNoLongerInTheShoppingList":
    "This product is no longer in the shopping list.",
  "ui.enterAPositivePriceUpTo1000000000000WithUpToTwoDecimalPlaces":
    "Enter a positive price up to 1,000,000,000,000 with up to two decimal places.",
  "ui.editAvatar": "Edit avatar",
  "ui.avatarEditor": "Avatar editor",
  "ui.userAvatar": "User avatar",
  "ui.chooseAvatar": "Choose avatar",
  "nav.overview": "Overview",
  "ui.expenseTracker": "Expense tracker",
  "ui.myProfile": "My profile",
  "ui.changesSaved": "Changes saved",
  "ui.expenseAddedEverythingIsUnderControl":
    "Expense added. Everything is under control!",
  "ui.expenseDeleted": "Expense deleted",
  "ui.expenseRestored": "Expense restored",
  "ui.date": "Date",
  "ui.title": "Title",
  "ui.amount": "Amount",
  "ui.currency": "Currency",
  "ui.category": "Category",
  "ui.note": "Note",
  "ui.backupImportedDuplicatesWereSkipped":
    "Backup imported. Duplicates were skipped.",
  "ui.demoLoadedYouCanEditOrDeleteAnyRecord":
    "Demo loaded. You can edit or delete any record.",
  "ui.actions": "Actions",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "ui.noResultsFound": "No results found",
  "ui.tryADifferentTitleOrChangeTheFilters":
    "Try a different title or change the filters.",
  "ui.resetFilters": "Reset filters",
  "ui.addExpense": "Add expense",
  "ui.mainNavigation": "Main navigation",
  "ui.savedOnThisDevice": "Saved on this device",
  "ui.unableToSave": "Unable to save",
  "ui.switchTheme": "Switch theme",
  "ui.openProfile": "Open profile",
  "ui.u": "U",
  "error.saveFailed": "Unable to save changes in the browser.",
  "ui.downloadBackup": "Download backup",
  "ui.everythingUnderControl": "Everything under control",
  "ui.previousMonth": "Previous month",
  "ui.chooseMonth": "Choose month",
  "ui.nextMonth": "Next month",
  "ui.overviewCurrency": "Overview currency",
  "ui.exploreDemo": "Explore demo",
  "ui.dismissTip": "Dismiss tip",
  "ui.monthlySpending": "Monthly spending",
  "ui.comparedWithLastMonth": "compared with last month",
  "ui.record": "record",
  "ui.records": "records",
  "ui.recordsAlternative": "records",
  "ui.budgetRemaining": "Budget remaining",
  "ui.monthlyBudget": "Monthly budget",
  "ui.notSet": "Not set",
  "ui.used": "% used",
  "ui.setAComfortableLimit": "Set a comfortable limit",
  "ui.dailyAverage": "Daily average",
  "ui.day": "day",
  "ui.days": "days",
  "ui.daysAlternative": "days",
  "ui.over": "Over",
  "ui.thisMonthAlternative": "this month",
  "ui.thisMonthHasNotStartedYet": "This month has not started yet",
  "ui.spendingOverTime": "Spending over time",
  "ui.7Days": "7 days",
  "ui.month": "Month",
  "ui.spending": "Spending",
  "ui.last7DaysOfTheSelectedMonth": "Last 7 days of the selected month",
  "ui.whereYourMoneyGoes": "Where your money goes",
  "ui.spendingBreakdownByCategory": "Spending breakdown by category",
  "ui.noCategorySpendingYet": "No category spending yet",
  "ui.categoryAlternative": "category",
  "ui.categories": "categories",
  "ui.categoriesAlternative": "categories",
  "ui.aFreshStart": "A fresh start",
  "ui.more": "More",
  "ui.recentExpenses": "Recent expenses",
  "ui.allExpenses": "All expenses",
  "ui.of": "of",
  "ui.overBudgetBy": "Over budget by",
  "ui.remaining": "Remaining",
  "ui.adjustBudget": "Adjust budget",
  "ui.setBudget": "Set budget",
  "ui.ofAllTime": "of all time",
  "ui.forTheSelectedMonth": "for the selected month",
  "ui.numberOfRecords": "Number of records",
  "ui.findAPurchaseOrNote": "Find a purchase or note…",
  "ui.searchExpenses": "Search expenses",
  "ui.clearSearch": "Clear search",
  "ui.filterByCategory": "Filter by category",
  "ui.allCategories": "All categories",
  "ui.filterByCurrency": "Filter by currency",
  "ui.allCurrencies": "All currencies",
  "ui.sortExpenses": "Sort expenses",
  "ui.newestFirst": "Newest first",
  "ui.oldestFirst": "Oldest first",
  "ui.amountAlternative": "Amount ↓",
  "ui.allTime": "All time",
  "ui.storageIsUnavailableDownloadABackup":
    "Storage is unavailable. Download a backup.",
  "ui.profileSettingsSaved": "Profile settings saved",
  "ui.personalSettings": "Personal settings",
  "ui.whatShouldWeCallYou": "What should we call you?",
  "ui.yourName": "Your name",
  "ui.optional": "optional",
  "ui.mainCurrency": "Main currency",
  "ui.monthlyBudgetAlternative": "Monthly budget",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "ui.system": "System",
  "ui.saveSettings": "Save settings",
  "ui.totalRecords": "Total records",
  "ui.dataSize": "Data size",
  "ui.kb": "KB",
  "ui.status": "Status",
  "ui.saved": "Saved",
  "ui.saveFailed": "Save failed",
  "ui.importBackup": "Import backup",
  "ui.tryAnExample": "Try an example",
  "ui.loadDemo": "Load demo",
  "ui.deleteAllData": "Delete all data",
  "ui.startFresh": "Start fresh?",
  "ui.loadDemoAlternative": "Load demo?",
  "common.close": "Close",
  "ui.downloadABackupFirst": "Download a backup first",
  "common.cancel": "Cancel",
  "ui.dataDeletedYouCanStartFresh": "Data deleted. You can start fresh.",
  "ui.undo": "Undo",
  "ui.dismissNotification": "Dismiss notification",
  "ui.dailySpending": "Daily spending,",
  "ui.manageExpenses": "Manage expenses",
  "ui.enterATitleAValidDateAndAnAmountOfAtLeast001":
    "Enter a title, a valid date and an amount of at least 0.01.",
  "ui.editExpense": "Edit expense",
  "ui.newExpense": "New expense",
  "ui.whatDidYouSpendOn": "What did you spend on?",
  "ui.forExampleCoffeeAndACroissant": "For example, coffee and a croissant",
  "ui.purchaseDate": "Purchase date",
  "common.save": "Save",
  "category.food": "Food & groceries",
  "category.shopping": "Shopping",
  "category.transport": "Transport",
  "category.home": "Home",
  "category.entertainment": "Entertainment",
  "category.health": "Health",
  "category.other": "Other",
  "currency.usd": "US dollar",
  "currency.eur": "Euro",
  "currency.kzt": "Kazakhstani tenge",
  "ui.interfaceLanguage": "Interface language",
  "ui.russian": "Russian",
  "ui.english": "English",
  "ui.towardsYourTreasure": "Towards your treasure",
  "ui.belilogHome": "BeliLog — home",
  "ui.openRecord": "Open record",
  "ui.changeAvatar": "Change avatar",
  "ui.removeAvatar": "Remove avatar",
  "ui.avatarSaved": "Avatar saved",
  "ui.createPdf": "Create PDF",
  "ui.pdfBackupWithAllYourData": "PDF backup with all your data",
  "ui.importPdfBackup": "Import PDF backup",
  "ui.backupVerified": "Backup verified",
  "ui.chooseHowToRestoreYourDataYouCanMergeYourCurrentRecordsWithTheBackup":
    "Choose how to restore your data. You can merge your current records with the backup.",
  "ui.restoreEverything": "Restore everything",
  "ui.addRecords": "Add records",
  "ui.backupRestored": "Backup restored",
  "ui.theTotalIsLowerThanTheItemizedPurchasesUpdateTheItemsFirst":
    "The total is lower than the itemized purchases. Update the items first.",
  "ui.user": "User",
  "ui.activityCalendar": "Activity calendar",
  "ui.previousYear": "Previous year",
  "ui.nextYear": "Next year",
  "ui.dailyActivity": "Daily activity",
  "ui.less": "Less",
  "ui.moreAlternative": "More",
  "ui.activeDays": "active days",
  "ui.theItemTotalCannotExceedTheRecordAmount":
    "The item total cannot exceed the record amount.",
  "ui.enterATitleAndAnAmountOfAtLeast001":
    "Enter a title and an amount of at least 0.01.",
  "ui.aRecordCanContainUpTo200Items": "A record can contain up to 200 items.",
  "ui.whatYouBought": "What you bought",
  "ui.itemName": "Item name",
  "ui.forExampleBread": "For example, bread",
  "common.add": "Add",
  "ui.itemized": "Itemized",
  "ui.leftToItemize": "Left to itemize",
  "ui.editRecord": "Edit record",
  "common.done": "Done",
  "ui.saveItem": "Save item",
  "ui.editItem": "Edit item",
  "ui.deleteItem": "Delete item",
  "ui.startAgain": "Start again",
  "ui.theBackupFileIsTooLarge": "The backup file is too large.",
  "ui.couldNotReadJsonChooseABelilogBackup":
    "Could not read JSON. Choose a BeliLog backup.",
  "ui.unsupportedBackupFormat": "Unsupported backup format.",
  "ui.theBackupContainsInvalidProfileSettings":
    "The backup contains invalid profile settings.",
  "ui.theBackupContainsAnInvalidExpenseList":
    "The backup contains an invalid expense list.",
  "ui.anExpenseContainsAnInvalidAmountCurrencyCategoryOrDate":
    "An expense contains an invalid amount, currency, category or date.",
  "ui.theBackupContainsDuplicateExpenseIds":
    "The backup contains duplicate expense IDs.",
  "ui.invalidExpenseCreationDate": "Invalid expense creation date.",
  "ui.anExpenseCanContainUpTo200Items":
    "An expense can contain up to 200 items.",
  "ui.anItemContainsAnInvalidAmount": "An item contains an invalid amount.",
  "ui.theExpenseContainsDuplicateItemIds":
    "The expense contains duplicate item IDs.",
  "ui.theItemTotalExceedsTheExpenseAmount":
    "The item total exceeds the expense amount.",
  "ui.anItemContainsAnInvalidCurrencyOrCreationDate":
    "An item contains an invalid currency or creation date.",
  "ui.theShoppingListContainsDuplicateItemIds":
    "The shopping list contains duplicate item IDs.",
  "ui.anExpenseCannotBeLinkedToMultipleShoppingItems":
    "An expense cannot be linked to multiple shopping items.",
  "ui.invalidCategoryBudgetList": "Invalid category budget list.",
  "ui.aBudgetContainsAnInvalidCategoryCurrencyOrAmount":
    "A budget contains an invalid category, currency or amount.",
  "ui.theBackupContainsDuplicateCategoryBudgets":
    "The backup contains duplicate category budgets.",
  "ui.youCanSaveUpTo20ShoppingTemplates":
    "You can save up to 20 shopping templates.",
  "ui.theBackupContainsDuplicateTemplateIds":
    "The backup contains duplicate template IDs.",
  "ui.invalidItemCurrencyInTheTemplate":
    "Invalid item currency in the template.",
  "ui.couldNotLoadThePdfFontPleaseTryAgain":
    "Could not load the PDF font. Please try again.",
  "ui.thePdfIsTooLargeTheLimitIs40Mb":
    "The PDF is too large. The limit is 40 MB.",
  "ui.chooseAPdfSavedByBelilog": "Choose a PDF saved by BeliLog.",
  "ui.couldNotReadThePdfChooseABelilogBackup":
    "Could not read the PDF. Choose a BeliLog backup.",
  "ui.thisPdfDoesNotContainABelilogBackup":
    "This PDF does not contain a BeliLog backup.",
  "ui.invalidPdfAttachmentTree": "Invalid PDF attachment tree.",
  "ui.theBackupEmbeddedInThisPdfIsDamaged":
    "The backup embedded in this PDF is damaged.",
  "ui.theEmbeddedBackupIsTooLarge": "The embedded backup is too large.",
  "ui.invalidShoppingItemCreationDate": "Invalid shopping item creation date.",
  "ui.thisExpenseIsAlreadyLinkedToAnotherShoppingItem":
    "This expense is already linked to another shopping item.",
  "ui.anItemWithThisIdIsAlreadyInTheShoppingList":
    "An item with this ID is already in the shopping list.",
  "ui.anExpenseWithThisIdAlreadyExists":
    "An expense with this ID already exists.",
  "ui.invalidFieldFieldInTheBackup": "Invalid field “{field}” in the backup.",
  "ui.fieldFieldCannotBeEmpty": "Field “{field}” cannot be empty.",
  "ui.invalidFieldField": "Invalid field “{field}”.",
  "ui.theJournalCanContainUpToCountEntries":
    "The journal can contain up to {count} entries.",
  "ui.theShoppingListCanContainUpToCountItems":
    "The shopping list can contain up to {count} items.",
  "ui.theBackupContainsInvalidCheckInHistory":
    "The backup contains invalid check-in history.",
  "streak.newRank": "New pirate rank",
  "ui.exchangeRatesAreInvalidEnterPositiveValuesFrom0000001To1000000WithAtMost6DecimalPlacesTheUsdBaseRateMustBe1":
    "Exchange rates are invalid. Enter positive values from 0.000001 to 1,000,000, with at most 6 decimal places; the USD base rate must be 1.",
  "ui.useUpAndDownToMoveOneDayLeftAndRightToMoveOneWeekHomeAndEndMoveToTheFirstAndLastDayOfTheWeekControlPlusHomeOrEndMovesToTheStartOrEndOfTheYearPressEnterOrSpaceToSelectADay":
    "Use Up and Down to move one day, Left and Right to move one week. Home and End move to the first and last day of the week; Control plus Home or End moves to the start or end of the year. Press Enter or Space to select a day.",
  "ui.byDateAddedOlderRecordsUseThePurchaseDate":
    "By date added; older records use the purchase date.",
  "ui.limitReached": "Limit reached",
  "ui.overLimit": "Over limit",
  "ui.nearLimit": "Near limit",
  "ui.onTrack": "On track",
  "ui.enterAValidAmountUpTo2DecimalPlaces":
    "enter a valid amount (up to 2 decimal places).",
  "ui.couldNotSaveReloadCurrentLimitsAndTryAgain":
    "Could not save. Reload current limits and try again.",
  "ui.perMonthLeaveBlankOrEnter0ForNoLimit":
    "Per month. Leave blank or enter 0 for no limit.",
  "ui.noLimit": "No limit",
  "ui.reloadCurrentLimits": "Reload current limits",
  "ui.useLeftAndRightArrowKeysToChooseADayHomeForTheFirstDayAndEndForTheLastDayYouCanAlsoChooseADayFromTheListBelowTheChart":
    "Use Left and Right arrow keys to choose a day, Home for the first day and End for the last day. You can also choose a day from the list below the chart.",
  "ui.dayAlternative": "Day",
  "ui.expenseHistoryPages": "Expense history pages",
  "ui.previousPage": "Previous page",
  "ui.nextPage": "Next page",
  "ui.monthlyLimit": "monthly limit",
  "ui.overBy": "Over by ",
  "field.expenseId": "Expense ID",
  "field.expenseTitle": "Expense title",
  "field.note": "Note",
  "field.purchaseId": "Purchase ID",
  "field.purchaseTitle": "Item name",
  "field.shoppingItemId": "Shopping item ID",
  "field.shoppingItemTitle": "Shopping item name",
  "field.linkedExpenseId": "Linked expense ID",
  "field.templateId": "Template ID",
  "field.templateName": "Template name",
  "field.name": "Name",
  "field.email": "Email",
} satisfies Record<MessageKey, string>;

export type MessageValue = string | number | { readonly key: MessageKey };
export type MessageValues = Readonly<Record<string, MessageValue>>;
export function message(
  language: Language,
  key: MessageKey,
  values: MessageValues = {},
): string {
  const text = language === "en" ? english[key] : russian[key];
  return text.replace(/\{(\w+)\}/g, (token, name: string) =>
    formatMessageValue(language, values[name], token),
  );
}

const numberFormatters = {
  ru: new Intl.NumberFormat("ru-RU"),
  en: new Intl.NumberFormat("en-US"),
};

function formatMessageValue(
  language: Language,
  value: MessageValue | undefined,
  fallback: string,
): string {
  return value === undefined
    ? fallback
    : typeof value === "object"
      ? message(language, value.key)
      : typeof value === "number"
        ? numberFormatters[language].format(value)
        : value;
}
