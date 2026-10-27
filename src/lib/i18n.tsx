import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Language } from "./finance";

const english: Readonly<Record<string, string>> = {
  "Редактировать аватар": "Edit avatar",
  "Редактор аватара": "Avatar editor",
  "Переместите и увеличьте фото перед сохранением. PNG, JPG или WebP до 8 МБ.":
    "Move and zoom your photo before saving. PNG, JPG or WebP up to 8 MB.",
  "Аватар пользователя": "User avatar",
  "Выбрать аватар": "Choose avatar",
  "Файл слишком большой. Максимум — 40 МБ.":
    "The file is too large. Maximum size: 40 MB.",
  "В журнале может быть не больше 50 000 записей.":
    "The journal can contain up to 50,000 records.",
  "Восстановить всё заменит текущие расходы, профиль и настройки.":
    "Restore everything replaces your current expenses, profile and settings.",
  "Понимать свои расходы — уже хорошая привычка.":
    "Knowing your spending is a good habit already.",
  покупка: "purchase",
  покупки: "purchases",

  Обзор: "Overview",
  "Трекер расходов": "Expense tracker",
  "Мой профиль": "My profile",
  "Изменения из другой вкладки синхронизированы":
    "Changes from another tab have been synced",
  "Изменения сохранены": "Changes saved",
  "Расход добавлен. Всё под контролем!":
    "Expense added. Everything is under control!",
  "Расход удалён": "Expense deleted",
  "Расход восстановлен": "Expense restored",
  "Резервная копия скачана": "Backup downloaded",
  Дата: "Date",
  Название: "Title",
  Сумма: "Amount",
  Валюта: "Currency",
  Категория: "Category",
  Заметка: "Note",
  "Расходы экспортированы в CSV": "Expenses exported to CSV",
  "Файл слишком большой. Максимум — 10 МБ.":
    "The file is too large. Maximum size: 10 MB.",
  "Копия импортирована. Дубликаты пропущены.":
    "Backup imported. Duplicates were skipped.",
  "Демо загружено. Можно редактировать и удалять любые записи.":
    "Demo loaded. You can edit or delete any record.",
  Действия: "Actions",
  Изменить: "Edit",
  Удалить: "Delete",
  "Ничего не нашлось": "No results found",
  "Большая ясность начинается с малого": "Small steps bring greater clarity",
  "Попробуйте другое название или измените фильтры.":
    "Try a different title or change the filters.",
  "Добавьте первую покупку — мы соберём всё остальное в понятную картину.":
    "Add your first purchase to start seeing the bigger picture.",
  "Сбросить фильтры": "Reset filters",
  "Добавить расход": "Add expense",
  "ЛИЧНОЕ ПРОСТРАНСТВО": "PERSONAL SPACE",
  "Основная навигация": "Main navigation",
  "Маленькие шаги.": "Small steps.",
  "Большая разница.": "A big difference.",
  "Понимать свои расходы —": "Understanding your spending is",
  "уже хорошая привычка.": "already a good habit.",
  "Сохранено на устройстве": "Saved on this device",
  "Не удалось сохранить": "Unable to save",
  "Ваши финансы, яснее.": "Your finances, clearer.",
  "Личное пространство": "Personal space",
  Локально: "Local",
  "Переключить тему": "Switch theme",
  "Открыть профиль": "Open profile",
  П: "U",
  "Не удалось сохранить изменения в браузере.":
    "Unable to save changes in the browser.",
  "Скачайте резервную копию до закрытия страницы, чтобы сохранить записи.":
    "Download a backup before closing this page to keep your records.",
  "Скачать копию": "Download backup",
  "МЕНЬШЕ ХАОСА. БОЛЬШЕ ЯСНОСТИ.": "LESS CLUTTER. MORE CLARITY.",
  "У КАЖДОЙ ПОКУПКИ ЕСТЬ ИСТОРИЯ": "EVERY PURCHASE HAS A STORY",
  "ПРОСТРАНСТВО, КОТОРОЕ ПОДСТРАИВАЕТСЯ ПОД ВАС": "A SPACE THAT ADAPTS TO YOU",
  "Всё под контролем": "Everything under control",
  "Ваши расходы, привычки и немного спокойствия.":
    "Your spending, your habits and a little peace of mind.",
  "Записывайте важное. Замечайте повседневное.":
    "Record what matters. Notice the everyday.",
  "Ваши настройки и данные — в одном месте.":
    "Your settings and data, all in one place.",
  Экспорт: "Export",
  "Предыдущий месяц": "Previous month",
  "Выбрать месяц": "Choose month",
  "Следующий месяц": "Next month",
  "Валюта обзора": "Overview currency",
  "Место для ваших финансовых привычек": "A home for your financial habits",
  "Начните с первой покупки или посмотрите, как всё работает, на примере.":
    "Start with your first purchase or explore a working example.",
  "Посмотреть демо": "Explore demo",
  "Скрыть подсказку": "Dismiss tip",
  "Расходы за месяц": "Monthly spending",
  "к прошлому месяцу": "compared with last month",
  запись: "record",
  записи: "records",
  записей: "records",
  "за этот месяц": "this month",
  "Новый месяц — чистый лист": "A new month, a fresh start",
  "Осталось в бюджете": "Budget remaining",
  "Месячный бюджет": "Monthly budget",
  "Не задан": "Not set",
  "% использовано": "% used",
  "Задать комфортный лимит": "Set a comfortable limit",
  "В среднем за день": "Daily average",
  день: "day",
  дня: "days",
  дней: "days",
  За: "Over",
  месяца: "this month",
  "Месяц ещё не начался": "This month has not started yet",
  "Динамика расходов": "Spending over time",
  "Маленькие покупки складываются в картину":
    "Small purchases tell the bigger story",
  "7 дней": "7 days",
  Месяц: "Month",
  Расходы: "Spending",
  "Последние 7 дней выбранного месяца": "Last 7 days of the selected month",
  "По дням месяца": "By day of the month",
  "Куда уходят деньги": "Where your money goes",
  "Всё по своим местам": "Everything in its place",
  "Распределение расходов по категориям": "Spending breakdown by category",
  "Пока нет расходов по категориям": "No category spending yet",
  категория: "category",
  категории: "categories",
  категорий: "categories",
  "Всё впереди": "A fresh start",
  "Добавьте расходы, и здесь появится": "Add expenses to see",
  "распределение по категориям.": "your category breakdown here.",
  Ещё: "More",
  "Последние расходы": "Recent expenses",
  "Из маленьких деталей состоит ваш день": "Your day is made of small details",
  "Все расходы": "All expenses",
  "С заботой о будущем": "Looking after your future",
  "Небольшой ориентир помогает принимать большие решения спокойнее.":
    "A small guideline makes big decisions feel easier.",
  "Задайте месячный бюджет, чтобы понимать, сколько ещё можно потратить.":
    "Set a monthly budget to know how much you can still spend.",
  от: "of",
  "Лимит превышен на": "Over budget by",
  "В запасе": "Remaining",
  "Настроить бюджет": "Adjust budget",
  "Установить бюджет": "Set budget",
  "Только вы и ваши финансы. Данные хранятся в этом браузере.":
    "Just you and your finances. Your data stays in this browser.",
  "Суммы в валюте обзора — по условному курсу.":
    "Overview totals use illustrative exchange rates.",
  "за всё время": "of all time",
  "за выбранный месяц": "for the selected month",
  "Количество записей": "Number of records",
  расход: "expense",
  расхода: "expenses",
  расходов: "expenses",
  "Каждая запись — шаг к ясности": "Every record is a step towards clarity",
  "Найти покупку или заметку…": "Find a purchase or note…",
  "Поиск расходов": "Search expenses",
  "Очистить поиск": "Clear search",
  "Фильтр по категории": "Filter by category",
  "Все категории": "All categories",
  "Фильтр по валюте": "Filter by currency",
  "Все валюты": "All currencies",
  "Сортировка расходов": "Sort expenses",
  "Сначала новые": "Newest first",
  "Сначала старые": "Oldest first",
  "По сумме ↓": "Amount ↓",
  "Найдено записей:": "Records found:",
  "За всё время": "All time",
  "Все изменения сохраняются автоматически":
    "All changes are saved automatically",
  "Хранилище недоступно. Скачайте резервную копию.":
    "Storage is unavailable. Download a backup.",
  "Скачать CSV": "Download CSV",
  "Суммы покупок сохраняются в исходной валюте. Итог в":
    "Purchase amounts keep their original currency. Totals in",
  "— по условному курсу.": "use illustrative rates.",
  "О курсах": "About exchange rates",
  "Настройки профиля сохранены": "Profile settings saved",
  "Личные настройки": "Personal settings",
  "Пусть здесь всё будет по-вашему": "Make this space your own",
  "Ваше личное финансовое пространство": "Your personal finance space",
  "Локальный профиль": "Local profile",
  "Как к вам обращаться": "What should we call you?",
  "Ваше имя": "Your name",
  необязательно: "optional",
  "Только заметка в профиле, без рассылок.":
    "Just a profile note. No emails or newsletters.",
  "Ваш финансовый ориентир": "Your financial compass",
  "Лимит применяется к каждому месяцу. Его можно менять в любой момент.":
    "Your budget applies to every month. Change it at any time.",
  "Основная валюта": "Main currency",
  "Бюджет на месяц": "Monthly budget",
  "Для общей картины — условные курсы":
    "Illustrative rates for the bigger picture",
  ". Они не обновляются автоматически. Каждая покупка хранится в своей валюте.":
    ". These rates do not update automatically. Each purchase keeps its own currency.",
  "Больше света или глубины?": "Light or a little more depth?",
  "Выберите комфортное оформление.": "Choose the look that feels right.",
  Светлая: "Light",
  Тёмная: "Dark",
  "Как в системе": "System",
  "Останется только на этом устройстве": "Stays on this device",
  "Сохранить настройки": "Save settings",
  "Ваши данные.": "Your data.",
  "В ваших руках.": "In your hands.",
  "Без аккаунтов и облака. Все записи хранятся в браузере на этом устройстве.":
    "No account or cloud. All records stay in the browser on this device.",
  "Всего записей": "Total records",
  "Размер данных": "Data size",
  КБ: "KB",
  Состояние: "Status",
  Сохранено: "Saved",
  "Ошибка сохранения": "Save failed",
  "Скачать резервную копию": "Download backup",
  "Импортировать копию": "Import backup",
  "Импорт добавит новые записи без дубликатов. Настройки профиля сохранятся. Очистка данных браузера удалит записи — сохраните копию.":
    "Import adds new records and skips duplicates. Your profile settings stay the same. Clearing browser data removes your records, so keep a backup.",
  "Попробовать на примере": "Try an example",
  "Демо с расходами, категориями и бюджетом.":
    "Explore demo expenses, categories and a budget.",
  "Загрузить демо": "Load demo",
  "Удалить все данные": "Delete all data",
  "Удаляет профиль и расходы из этого браузера.":
    "Removes the profile and expenses from this browser.",
  "УПРАВЛЕНИЕ ДАННЫМИ": "DATA MANAGEMENT",
  "ПОПРОБОВАТЬ НА ПРИМЕРЕ": "TRY AN EXAMPLE",
  "Начать с чистого листа?": "Start fresh?",
  "Загрузить демо?": "Load demo?",
  Закрыть: "Close",
  "Все расходы и настройки будут удалены из этого браузера. Перед удалением можно скачать резервную копию.":
    "All expenses and settings will be removed from this browser. You can download a backup first.",
  "Демо заменит текущие расходы и настройки. Скачайте копию, чтобы вернуться к своим данным.":
    "The demo will replace your current expenses and settings. Download a backup to restore your data later.",
  "Скачать копию перед заменой": "Download a backup first",
  Отмена: "Cancel",
  "Данные удалены. Можно начать заново.": "Data deleted. You can start fresh.",
  Вернуть: "Undo",
  "Закрыть уведомление": "Dismiss notification",
  "Наведите на столбик для подробностей": "Hover over a bar for details",
  "Здесь появится ваша финансовая история":
    "Your financial story will appear here",
  "Расходы по дням,": "Daily spending,",
  "Управление расходами": "Manage expenses",
  "Укажите название, корректную дату и сумму не меньше 0,01.":
    "Enter a title, a valid date and an amount of at least 0.01.",
  "ЕЩЁ ОДНА ДЕТАЛЬ В ОБЩЕЙ КАРТИНЕ": "ANOTHER DETAIL IN THE BIGGER PICTURE",
  "Изменить расход": "Edit expense",
  "Новый расход": "New expense",
  "На что потратили?": "What did you spend on?",
  "Например, кофе и круассан": "For example, coffee and a croissant",
  "Дата покупки": "Purchase date",
  "Что-нибудь, что стоит запомнить…": "Something worth remembering…",
  "Только на вашем устройстве": "Only on your device",
  Сохранить: "Save",
  "Еда и продукты": "Food & groceries",
  Покупки: "Shopping",
  Транспорт: "Transport",
  Дом: "Home",
  Развлечения: "Entertainment",
  Здоровье: "Health",
  Другое: "Other",
  "Доллар США": "US dollar",
  Евро: "Euro",
  "Казахстанский тенге": "Kazakhstani tenge",
  "Условный курс: 1 USD = 0,92 EUR = 480 KZT":
    "Illustrative rate: 1 USD = 0.92 EUR = 480 KZT",
  "Язык интерфейса": "Interface language",
  "Выберите язык. Настройка сохраняется сразу.":
    "Choose a language. This setting is saved immediately.",
  Русский: "Russian",
  Английский: "English",
  "Навстречу своим сокровищам": "Towards your treasure",
  "Ваши финансы — ваше приключение. Следите за каждым бери и держите курс к своим целям.":
    "Your finances, your adventure. Track every berry and stay on course towards your goals.",
  "Личный журнал · Без облака": "Personal log · No cloud",
  "НАКАМА, ДОБРО ПОЖАЛОВАТЬ НА БОРТ": "NAKAMA, WELCOME ABOARD",
  "Журнал расходов": "Expense log",
  "BeliLog — главная": "BeliLog — home",
  "Открыть запись": "Open record",
  покупок: "purchases",
  "Сменить аватар": "Change avatar",
  "Удалить аватар": "Remove avatar",
  "PNG, JPG или WebP до 8 МБ. Изображение сохранится на устройстве.":
    "PNG, JPG or WebP up to 8 MB. Your image stays on this device.",
  "Аватар сохранён": "Avatar saved",
  "Не удалось загрузить аватар. Выберите PNG, JPG или WebP до 8 МБ.":
    "Unable to load the avatar. Choose a PNG, JPG or WebP up to 8 MB.",
  "Создать PDF": "Create PDF",
  "PDF-отчёт скачан": "PDF report downloaded",
  "Не удалось создать PDF. Попробуйте ещё раз.":
    "Unable to create the PDF. Please try again.",
  "PDF-копия со всеми данными": "PDF backup with all your data",
  "PDF со всеми записями, аватаром и настройками. Подходит для восстановления.":
    "A PDF with all records, your avatar and settings. Use it to restore your data.",
  "Импортировать PDF-копию": "Import PDF backup",
  "Выберите PDF-копию BeliLog или старый JSON-файл.":
    "Choose a BeliLog PDF backup or an older JSON file.",
  "Восстановить профиль из копии": "Restore profile from backup",
  "Добавить новые записи": "Add new records",
  "Копия проверена": "Backup verified",
  "Выберите, как восстановить данные. Текущие записи можно объединить с копией.":
    "Choose how to restore your data. You can merge your current records with the backup.",
  "Восстановить всё": "Restore everything",
  "Добавить записи": "Add records",
  "Копия восстановлена": "Backup restored",
  "Все настройки сохраняются автоматически.":
    "All settings are saved automatically.",
  "Состав покупки сохранён": "Purchase details saved",
  "Общая сумма меньше суммы покупок внутри записи. Сначала измените состав.":
    "The total is lower than the itemized purchases. Update the items first.",
  "Все данные сохранены на устройстве": "All data is saved on this device",
  Пользователь: "User",
  "ЖУРНАЛ КАПИТАНА": "CAPTAIN’S LOG",
  "Календарь активности": "Activity calendar",
  "Каждая запись — маленький шаг к большому сокровищу.":
    "Every record is a small step towards a great treasure.",
  "Предыдущий год": "Previous year",
  "Следующий год": "Next year",
  "Активность по дням": "Daily activity",
  Меньше: "Less",
  Больше: "More",
  "записей за год": "records this year",
  "активных дней": "active days",
  "дней подряд — лучший результат": "day streak — personal best",
  "Считаем день создания записи, а не дату покупки. Для старых записей используем дату покупки.":
    "Activity follows the day you create a record. Older records use the purchase date.",
  "Сумма покупок не может превышать общую сумму записи.":
    "The item total cannot exceed the record amount.",
  "Укажите название и сумму не меньше 0,01.":
    "Enter a title and an amount of at least 0.01.",
  "В одной записи может быть не больше 200 покупок.":
    "A record can contain up to 200 items.",
  "СУДОВОЙ ЖУРНАЛ · ДЕТАЛИ ЗАПИСИ": "SHIP’S LOG · RECORD DETAILS",
  "Что было в покупке": "What you bought",
  "Здесь можно расшифровать покупку: батон, филе и всё остальное.":
    "Break down your purchase here: bread, fillet and everything else.",
  "Название покупки": "Item name",
  "Например, батон": "For example, bread",
  Добавить: "Add",
  Расшифровано: "Itemized",
  "Осталось расшифровать": "Left to itemize",
  "Покупки сохраняются сразу после добавления или изменения.":
    "Items are saved as soon as you add or edit them.",
  "Изменить запись": "Edit record",
  Готово: "Done",
  "Сохранить покупку": "Save item",
  "Изменить покупку": "Edit item",
  "Удалить покупку": "Delete item",
  "Не удалось прочитать копию. Выберите PDF-копию BeliLog или старый JSON-файл.":
    "Unable to read the backup. Choose a BeliLog PDF backup or an older JSON file.",
};

/** Translate interface copy only; user-entered names, notes and purchases stay intact. */
export function translate(language: Language, text: string): string {
  return language === "en" ? (english[text] ?? text) : text;
}
const LanguageContext = createContext<Language>("ru");
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useI18n() {
  const language = useContext(LanguageContext);
  return { language, tr: (text: string) => translate(language, text) };
}
