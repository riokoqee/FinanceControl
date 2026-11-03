import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Ellipsis,
  HeartPulse,
  Home,
  LayoutDashboard,
  Compass,
  Camera,
  ListChecks,
  Moon,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  Utensils,
  Wallet,
  X,
  Monitor,
  Car,
  Clapperboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  CATEGORIES,
  CURRENCIES,
  MAX_AMOUNT,
  MAX_TRANSACTIONS,
  RATE_LABEL,
  convertAmount,
  createDemoData,
  createEmptyData,
  formatMoney,
  getMonthTransactions,
  getItemTotal,
  todayString,
  validateBackup,
} from "./lib/finance";
import type {
  AppData,
  CategoryId,
  Currency,
  Profile,
  Transaction,
} from "./lib/finance";

import { usePersistentData } from "./lib/usePersistentData";
import { DataConflictError, mergeAppData, mergeTransactionDraft, parseMoney } from "./lib/storage";
import TransactionTable from "./components/TransactionTable";
import ExpenseChart from "./components/ExpenseChart";
import ActivityCalendar from "./components/ActivityCalendar";
import EntryDetails from "./components/EntryDetails";
import AvatarCropper from "./components/AvatarCropper";
import ShoppingList from "./components/ShoppingList";
import { addShoppingItem, removeShoppingItem, saveShoppingPrice, updateShoppingItem } from "./lib/shopping";
import StreakBounty, {
  StreakBadge,
  useStreakStats,
} from "./components/StreakBounty";
import type { BountyCelebration } from "./components/StreakBounty";
import { getStreakStats } from "./lib/streak";
import { getStreakIncrease } from "./lib/pirateRanks";
import { LanguageProvider, translate, useI18n } from "./lib/i18n";
import type { Language } from "./lib/finance";

type Page = "overview" | "tracker" | "shopping" | "profile";
type Toast = { message: string; error?: boolean; undo?: () => void; pirate?: boolean };
const categoryIcons: Record<CategoryId, LucideIcon> = {
  food: Utensils,
  shopping: ShoppingBag,
  transport: Car,
  home: Home,
  entertainment: Clapperboard,
  health: HeartPulse,
  other: Ellipsis,
};
const categoryColors: Record<CategoryId, string> = {
  food: "#C35D4C",
  shopping: "#5A9C9B",
  transport: "#718EAB",
  home: "#D7B777",
  entertainment: "#A68469",
  health: "#80B8A3",
  other: "#b7b9b5",
};
const pageLabels: Record<Page, string> = {
  overview: "Обзор",
  tracker: "Трекер расходов",
  shopping: "Список покупок",
  profile: "Мой профиль",
};
const monthLabel = (month: string, language: Language = "ru") =>
  new Date(`${month}-01T12:00:00`)
    .toLocaleDateString(language === "en" ? "en-US" : "ru-RU", {
      month: "long",
      year: "numeric",
    })
    .replace(" г.", "");
const currentMonth = () => todayString().slice(0, 7);
const shortMoney = (n: number, c: Currency, language: Language = "ru") =>
  formatMoney(n, c, language);
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function readPage(): Page {
  const value = window.location.hash.slice(1);
  return value === "tracker" || value === "shopping" || value === "profile" ? value : "overview";
}
function createRecordId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
function Button({
  children,
  onClick,
  variant = "secondary",
  type = "button",
  className = "",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export default function App() {
  const { data, commit, status: storageStatus, error: storageError, lastError } = usePersistentData();
  const storageOk = !storageError && (storageStatus === "ready" || storageStatus === "empty");
  const setData = (change: AppData | ((value: AppData) => AppData)) => {
    const next = commit(change);
    if (next) latest.current = { ...latest.current, data: next };
    return next;
  };
  const language = data.profile.language;
  const streak = useStreakStats(data.transactions);
  const tr = (text: string) => translate(language, text);
  const [page, setPage] = useState<Page>(readPage);
  const [month, setMonth] = useState(currentMonth);
  const [modal, setModal] = useState<"new" | Transaction | null>(null);
  const [confirmation, setConfirmation] = useState<"reset" | "demo" | "recovery" | null>(
    null,
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [avatarSource, setAvatarSource] = useState<{
    file?: File;
    src?: string;
  } | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [bountyCelebration, setBountyCelebration] = useState<(BountyCelebration & { page: Page }) | null>(null);
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [chartRange, setChartRange] = useState<"month" | "week">("month");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [sort, setSort] = useState("newest");
  const [allTime, setAllTime] = useState(false);
  const [profile, setProfile] = useState<Profile>(data.profile);
  const profileBase = useRef(data.profile);
  const importRef = useRef<HTMLInputElement>(null);
  const currency = data.profile.currency;
  const detailRecord = data.transactions.find((t) => t.id === detailId);
  const latest = useRef({ data, profile, page });
  latest.current = { data, profile, page };
  const transactions = useMemo(
    () => getMonthTransactions(data.transactions, month),
    [data.transactions, month],
  );
  const total = transactions.reduce(
    (s, t) => s + convertAmount(t.amount, t.currency, currency),
    0,
  );
  const budget = data.profile.monthlyBudget;
  const progress = budget ? (total / budget) * 100 : 0;
  const remaining = Math.max(0, budget - total);
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const elapsedDays =
    month === currentMonth()
      ? new Date().getDate()
      : month > currentMonth()
        ? 0
        : daysInMonth;
  const average = elapsedDays ? total / elapsedDays : 0;
  const previousMonth = new Date(`${month}-01T12:00:00`);
  previousMonth.setMonth(previousMonth.getMonth() - 1);
  const previousTotal = getMonthTransactions(
    data.transactions,
    localDate(previousMonth).slice(0, 7),
  ).reduce((s, t) => s + convertAmount(t.amount, t.currency, currency), 0);
  const changePercent = previousTotal
    ? ((total - previousTotal) / previousTotal) * 100
    : null;
  const categories = CATEGORIES.map((c) => ({
    ...c,
    value: transactions
      .filter((t) => t.category === c.id)
      .reduce((s, t) => s + convertAmount(t.amount, t.currency, currency), 0),
  }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
  const sortedTransactions = [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );
  const filtered = useMemo(
    () =>
      (allTime ? data.transactions : transactions)
        .filter(
          (t) =>
            (category === "all" || t.category === category) &&
            (filterCurrency === "all" || t.currency === filterCurrency) &&
            `${t.title} ${t.note ?? ""} ${(t.items ?? []).map((item) => item.title).join(" ")}`
              .toLocaleLowerCase("ru")
              .includes(search.toLocaleLowerCase("ru")),
        )
        .sort((a, b) =>
          sort === "largest"
            ? convertAmount(b.amount, b.currency, currency) -
              convertAmount(a.amount, a.currency, currency)
            : sort === "oldest"
              ? a.date.localeCompare(b.date)
              : b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        ),
    [
      allTime,
      data.transactions,
      transactions,
      category,
      filterCurrency,
      search,
      sort,
      currency,
    ],
  );

  useEffect(() => {
    if (storageError) setToast({ message: storageError, error: true });
  }, [storageError]);

  useLayoutEffect(() => {
    if (
      page !== "profile" ||
      !profile.name.trim() ||
      !Number.isFinite(profile.monthlyBudget) ||
      profile.monthlyBudget < 0 ||
      profile.monthlyBudget > 1e12
    )
      return;
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))
      return;
    const nextProfile = {
      ...profile,
      name: profile.name.trim(),
      email: profile.email.trim(),
    };
    if (JSON.stringify(profileBase.current) === JSON.stringify(nextProfile)) return;
    const saved = setData((d) => mergeAppData(
      { ...d, profile: profileBase.current }, d, { ...d, profile: nextProfile },
    ));
    if (saved) {
      profileBase.current = saved.profile;
      setProfile(saved.profile);
    }
  }, [profile, page]);
  useEffect(() => {
    const handler = () => setPage(readPage());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark =
        data.profile.theme === "dark" ||
        (data.profile.theme === "system" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", dark ? "#101D2C" : "#F1E5CB");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data.profile.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 8000 : 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!bountyCelebration) return;
    const timer = setTimeout(() => setBountyCelebration(null), Math.max(0, bountyCelebration.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [bountyCelebration]);
  useEffect(() => {
    // Navigation must not replay a reward on a newly mounted poster.
    setBountyCelebration(null);
  }, [page]);
  useEffect(() => {
    if (bountyCelebration && (!streak.activeToday || streak.current !== bountyCelebration.toDays)) {
      setBountyCelebration(null);
    }
  }, [streak.activeToday, streak.current, bountyCelebration]);
  useEffect(() => {
    if (page !== "profile" || JSON.stringify(profile) === JSON.stringify(profileBase.current)) {
      profileBase.current = data.profile;
      setProfile(data.profile);
    }
  }, [data.profile, page]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function navigate(next: Page) {
    setPage(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function shiftMonth(direction: number) {
    const next = new Date(`${month}-01T12:00:00`);
    next.setMonth(next.getMonth() + direction);
    setMonth(localDate(next).slice(0, 7));
  }
  function updateCurrency(next: Currency) {
    setData((d) => ({
      ...d,
      profile: {
        ...d.profile,
        currency: next,
        monthlyBudget: convertedBudget(d.profile.monthlyBudget, d.profile.currency, next),
      },
    }));
  }
  function convertedBudget(amount: number, from: Currency, to: Currency) {
    const converted = Math.round(convertAmount(amount, from, to) * 100) / 100;
    if (!Number.isFinite(converted) || converted > MAX_AMOUNT) {
      throw new Error("После смены валюты бюджет превышает допустимый максимум. Сначала уменьшите бюджет.");
    }
    return converted;
  }
  function saveTransaction(value: Transaction) {
    const editing = modal !== "new";
    const now = new Date();
    const currentTransactions = latest.current.data.transactions;
    const increase = editing ? null : getStreakIncrease(
      getStreakStats(currentTransactions, now),
      getStreakStats([value, ...currentTransactions], now),
    );
    const saved = setData((d) => {
      if (!editing && d.transactions.length >= MAX_TRANSACTIONS) throw new Error("В журнале может быть не больше 50 000 записей.");
      const record = editing && modal
        ? mergeTransactionDraft(modal, d.transactions.find((t) => t.id === value.id), value)
        : value;
      return { ...d, transactions: editing
        ? d.transactions.map((t) => t.id === value.id ? record : t)
        : [record, ...d.transactions] };
    });
    if (!saved) return lastError.current;
    setMonth(value.date.slice(0, 7));
    setModal(null);
    setBountyCelebration(increase ? {
      ...increase,
      id: value.id,
      expiresAt: Date.now() + 6000,
      page,
    } : null);
    setToast({
      message: increase?.promoted
        ? `${tr("Расход добавлен. Всё под контролем!")} ${language === "en" ? "New pirate rank" : "Новый пиратский ранг"}: ${increase.rank.name[language]}!`
        : editing
        ? tr("Изменения сохранены")
        : tr("Расход добавлен. Всё под контролем!"),
      pirate: increase?.promoted,
    });
    return true;
  }
  function commitShoppingChange(change: (current: AppData) => AppData): AppData | null {
    return setData(change);
  }
  function addPlannedItem(title: string, itemCurrency: Currency): boolean {
    return Boolean(commitShoppingChange((current) => addShoppingItem(current, {
      id: createRecordId(), title, currency: itemCurrency, createdAt: todayString(),
    })));
  }
  function checkShoppingBase(current: AppData, id: string, base: Transaction | null | undefined, patch: Partial<Transaction>) {
    if (base === undefined) return;
    const row = current.shoppingList?.find((item) => item.id === id);
    if (!row) throw new DataConflictError();
    const record = current.transactions.find((t) => t.id === row.transactionId);
    if ((record?.id ?? null) !== (base?.id ?? null)) throw new DataConflictError();
    if (record && base) for (const field of Object.keys(patch) as (keyof Transaction)[]) {
      if (record[field] !== base[field] && record[field] !== patch[field]) throw new DataConflictError();
    }
  }
  function updatePlannedItem(id: string, patch: { title?: string; currency?: Currency }, base?: Transaction | null): boolean {
    return Boolean(commitShoppingChange((current) => {
      checkShoppingBase(current, id, base, patch);
      return updateShoppingItem(current, id, patch);
    }));
  }
  function savePlannedPrice(id: string, amount: number, itemCurrency: Currency, base?: Transaction | null, changed?: { amount?: number; currency?: Currency }): boolean {
    const previous = latest.current.data;
    const now = new Date();
    const eventId = createRecordId();
    const next = commitShoppingChange((current) => {
      checkShoppingBase(current, id, base, changed ?? { amount, currency: itemCurrency });
      const row = current.shoppingList?.find((item) => item.id === id);
      const record = current.transactions.find((t) => t.id === row?.transactionId);
      return saveShoppingPrice(current, id,
        changed && changed.amount === undefined && record ? record.amount : amount,
        changed && changed.currency === undefined && record ? record.currency : itemCurrency,
        eventId, now);
    });
    if (!next) return false;
    const increase = next.transactions.length > previous.transactions.length
      ? getStreakIncrease(getStreakStats(previous.transactions, now), getStreakStats(next.transactions, now))
      : null;
    setBountyCelebration(increase ? { ...increase, id: eventId, expiresAt: Date.now() + 6000, page } : null);
    if (increase?.promoted) {
      setToast({
        message: `${language === "en" ? "New pirate rank" : "Новый пиратский ранг"}: ${increase.rank.name[language]}!`,
        pirate: true,
      });
    }
    return true;
  }
  function removePlannedItem(id: string): boolean {
    return Boolean(commitShoppingChange((current) => removeShoppingItem(current, id)));
  }
  function deleteTransaction(transaction: Transaction) {
    setBountyCelebration(null);
    const linkedItems = new Set(latest.current.data.shoppingList?.filter((item) => item.transactionId === transaction.id).map((item) => item.id));
    const saved = setData((d) => ({
      ...d,
      transactions: d.transactions.filter((t) => t.id !== transaction.id),
      ...(d.shoppingList ? { shoppingList: d.shoppingList.map((item) => {
        if (item.transactionId !== transaction.id) return item;
        const { transactionId: _removed, ...pending } = item;
        return pending;
      }) } : {}),
    }));
    if (!saved) return;
    setToast({
      message: "Расход удалён",
      undo: () => {
        const restored = setData((d) =>
          d.transactions.some((t) => t.id === transaction.id)
            ? d
            : {
                ...d,
                transactions: [...d.transactions, transaction],
                ...(d.shoppingList ? { shoppingList: d.shoppingList.map((item) =>
                  linkedItems.has(item.id) && !item.transactionId ? { ...item, transactionId: transaction.id } : item) } : {}),
              },
        );
        if (restored) setToast({ message: "Расход восстановлен" });
      },
    });
  }
  async function downloadPdf(records: Transaction[], backup = false) {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const { exportPdf } = await import("./lib/pdf");
      await exportPdf(data, {
        transactions: records,
        language,
        currency,
        title: backup
          ? tr("PDF-копия со всеми данными")
          : tr("Журнал расходов"),
        period:
          backup || allTime ? tr("За всё время") : monthLabel(month, language),
        includeBackup: backup,
      });
      setToast({
        message: backup ? "Резервная копия скачана" : "PDF-отчёт скачан",
      });
    } catch {
      setToast({
        message: "Не удалось создать PDF. Попробуйте ещё раз.",
        error: true,
      });
    } finally {
      setPdfBusy(false);
    }
  }
  function exportBackup() {
    void downloadPdf(data.transactions, true);
  }
  function exportReport() {
    void downloadPdf(page === "tracker" ? filtered : transactions);
  }
  async function importBackup(file?: File) {
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      setToast({
        message: "Файл слишком большой. Максимум — 40 МБ.",
        error: true,
      });
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-";
      const incoming = pdf
        ? await (await import("./lib/pdf")).readPdfBackup(bytes)
        : validateBackup(JSON.parse(new TextDecoder().decode(bytes)));
      setPendingImport(incoming);
    } catch {
      setToast({
        message: "Выберите PDF-копию BeliLog или старый JSON-файл.",
        error: true,
      });
    }
  }
  function restoreBackup(replaceAll: boolean) {
    if (!pendingImport) return;
    setBountyCelebration(null);
    if (replaceAll) {
      if (!commit(pendingImport, true)) return;
      setProfile(pendingImport.profile);
    } else {
      const saved = setData((current) => {
        const existing = new Set(current.transactions.map((t) => t.id));
        const transactions = [
          ...current.transactions,
          ...pendingImport.transactions.filter((t) => !existing.has(t.id)),
        ];
        if (transactions.length > 50000) {
          throw new Error("В журнале может быть не больше 50 000 записей.");
        }
        const shoppingList = [...(current.shoppingList ?? [])];
        const shoppingIds = new Set(shoppingList.map((item) => item.id));
        const linkedExpenses = new Set(shoppingList.flatMap((item) => item.transactionId ? [item.transactionId] : []));
        for (const item of pendingImport.shoppingList ?? []) {
          if (shoppingIds.has(item.id) || (item.transactionId && linkedExpenses.has(item.transactionId))) continue;
          shoppingList.push(item);
          shoppingIds.add(item.id);
          if (item.transactionId) linkedExpenses.add(item.transactionId);
        }
        if (shoppingList.length > 1000) {
          throw new Error("В списке покупок может быть не больше 1000 товаров.");
        }
        return { ...current, transactions, ...((current.shoppingList || pendingImport.shoppingList) ? { shoppingList } : {}) };
      });
      if (!saved) return;
    }
    setPendingImport(null);
    setDetailId(null);
    setToast({
      message: replaceAll
        ? "Копия восстановлена"
        : "Копия импортирована. Дубликаты пропущены.",
    });
  }
  function selectAvatar(file?: File) {
    if (file) setAvatarSource({ file });
  }
  function saveAvatar(avatar: string) {
    if (!setData((d) => ({ ...d, profile: { ...d.profile, avatar } }))) return;
    setProfile((p) => ({ ...p, avatar }));
    setAvatarSource(null);
    setToast({ message: "Аватар сохранён" });
  }
  function startDemo() {
    if (
      data.transactions.length ||
      data.shoppingList?.length ||
      data.profile.name !== "Пользователь" ||
      data.profile.email ||
      data.profile.avatar ||
      data.profile.monthlyBudget ||
      data.profile.currency !== "USD"
    ) {
      setConfirmation("demo");
      return;
    }
    applyDemo();
  }
  function applyDemo() {
    setBountyCelebration(null);
    const demo = createDemoData();
    const next = {
      ...demo,
      profile: {
        ...demo.profile,
        theme: data.profile.theme,
        language,
      },
    };
    if (!commit(next, true)) return;
    setProfile(next.profile);
    setMonth(currentMonth());
    setConfirmation(null);
    setShowDemoBanner(false);
    setToast({
      message: "Демо загружено. Можно редактировать и удалять любые записи.",
    });
  }
  const toggleTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    const saved = setData((d) => ({
      ...d,
      profile: { ...d.profile, theme: dark ? "light" : "dark" },
    }));
    if (saved) setProfile((p) => ({ ...p, theme: saved.profile.theme }));
  };
  const initials = data.profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const emptyState = (isFiltered = false) => (
    <div className="empty-state">
      <span className="empty-icon">
        {isFiltered ? <Search size={25} /> : <ArrowDownLeft size={27} />}
      </span>
      <h3 className="empty-title">
        {isFiltered
          ? tr("Ничего не нашлось")
          : tr("Большая ясность начинается с малого")}
      </h3>
      <p className="empty-description">
        {isFiltered
          ? tr("Попробуйте другое название или измените фильтры.")
          : tr(
              "Добавьте первую покупку — мы соберём всё остальное в понятную картину.",
            )}
      </p>
      <div className="empty-actions">
        {isFiltered ? (
          <Button
            onClick={() => {
              setSearch("");
              setCategory("all");
              setFilterCurrency("all");
              setAllTime(true);
            }}
          >
            {tr("Сбросить фильтры")}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setModal("new")}>
            <Plus size={17} />
            {tr("Добавить расход")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <LanguageProvider language={language}>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#overview"
            onClick={() => navigate("overview")}
            aria-label={tr("BeliLog — главная")}
          >
            <span className="brand-mark">
              <img src={`${import.meta.env.BASE_URL}belilog-icon-512.png`} alt="" />
            </span>
            <span className="brand-name">
              BeliLog
              <span className="brand-japanese" lang="ja">
                ベリログ
              </span>
              <span className="brand-tagline">Every Berry Counts.</span>
            </span>
          </a>
          <div className="sidebar-label">{tr("ЛИЧНОЕ ПРОСТРАНСТВО")}</div>
          <nav className="nav-list" aria-label={tr("Основная навигация")}>
            {(
              [
                { id: "overview", label: tr("Обзор"), shortLabel: tr("Обзор"), icon: LayoutDashboard },
                { id: "tracker", label: tr("Трекер расходов"), shortLabel: tr("Трекер"), icon: Wallet },
                { id: "shopping", label: tr("Список покупок"), shortLabel: tr("Покупки"), icon: ListChecks },
                { id: "profile", label: tr("Мой профиль"), shortLabel: tr("Профиль"), icon: UserRound },
              ] as const
            ).map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={`nav-item ${page === item.id ? "nav-active" : ""}`}
                aria-current={page === item.id ? "page" : undefined}
                aria-label={item.label}
                onClick={() => navigate(item.id)}
              >
                <item.icon size={19} strokeWidth={1.7} />
                <span className="nav-label"><span className="nav-label-full">{item.label}</span><span className="nav-label-short">{item.shortLabel}</span></span>
                {item.id === "tracker" && data.transactions.length > 0 && (
                  <span className="nav-count">{data.transactions.length}</span>
                )}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <span className="sidebar-tip-icon">
                <Compass size={22} strokeWidth={1.5} />
              </span>
              <strong>
                {tr("Маленькие шаги.")}
                <br />
                {tr("Большая разница.")}
              </strong>
              <p>{tr("Понимать свои расходы — уже хорошая привычка.")}</p>
            </div>
            <div
              className={`local-status ${!storageOk ? "storage-error" : ""}`}
            >
              <span className="status-dot" />
              <span>
                {storageOk
                  ? tr("Сохранено на устройстве")
                  : tr("Не удалось сохранить")}
              </span>
              <ShieldCheck size={14} />
            </div>
            <div className="sidebar-foot">
              <span>Every Berry Counts.</span>
              <span>v2.1</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <span>{tr("Личное пространство")}</span>
              <ChevronRight size={14} />
              <strong>{tr(pageLabels[page])}</strong>
            </div>
            <div className="topbar-actions">
              <StreakBadge
                transactions={data.transactions}
                language={language}
                onClick={() => navigate("overview")}
              />
              <span className="local-chip">
                <span className="status-dot" />
                {tr("Локально")}
              </span>
              <button
                className="theme-button icon-button"
                onClick={toggleTheme}
                aria-label={tr("Переключить тему")}
                title={tr("Переключить тему")}
              >
                {data.profile.theme === "dark" ||
                (data.profile.theme === "system" &&
                  window.matchMedia("(prefers-color-scheme: dark)").matches) ? (
                  <Sun size={19} />
                ) : (
                  <Moon size={19} />
                )}
              </button>
              <span className="topbar-divider" />
              <button
                className="avatar"
                onClick={() => navigate("profile")}
                title={tr("Открыть профиль")}
                aria-label={tr("Открыть профиль")}
              >
                {data.profile.avatar ? (
                  <img
                    src={data.profile.avatar}
                    alt={tr("Аватар пользователя")}
                  />
                ) : (
                  initials || tr("П")
                )}
              </button>
            </div>
          </header>
          <main className="workspace" id="main-content">
            {!storageOk && (
              <div className="storage-warning" role="alert">
                <CircleHelp size={21} />
                <div>
                  <strong>
                    {tr(storageStatus === "corrupt" || storageStatus === "recovered"
                      ? "Обнаружены повреждённые данные. Исходная копия сохранена."
                      : "Не удалось сохранить изменения в браузере.")}
                  </strong>
                  <p>
                    {tr(storageError || (storageStatus === "corrupt" || storageStatus === "recovered"
                      ? "Автосохранение приостановлено. Восстановите копию или начните заново."
                      : "Изменение не применено. Проверьте свободное место и доступ к хранилищу."))}
                  </p>
                </div>
                <Button onClick={exportBackup}>
                  <Download size={16} />
                  {tr("Скачать копию")}
                </Button>
                {storageStatus === "recovered" && <Button onClick={() => setConfirmation("recovery")}>{tr("Восстановить последнюю копию")}</Button>}
                {(storageStatus === "corrupt" || storageStatus === "recovered") && <>
                  <Button onClick={() => navigate("profile")}>{tr("Импортировать копию")}</Button>
                  <Button onClick={() => setConfirmation("reset")}>{tr("Начать заново")}</Button>
                </>}
              </div>
            )}
            <div className="page-enter" key={page}>
              <div className="page-heading">
                <div className="heading-copy">
                  <div className="eyebrow">
                    {page === "overview"
                      ? tr("МЕНЬШЕ ХАОСА. БОЛЬШЕ ЯСНОСТИ.")
                      : page === "tracker"
                        ? tr("У КАЖДОЙ ПОКУПКИ ЕСТЬ ИСТОРИЯ")
                        : page === "shopping"
                          ? tr("СНАЧАЛА СПИСОК. ПОТОМ ПОКУПКА.")
                        : tr("ПРОСТРАНСТВО, КОТОРОЕ ПОДСТРАИВАЕТСЯ ПОД ВАС")}
                  </div>
                  <h1>
                    {page === "overview"
                      ? tr("Всё под контролем")
                      : tr(pageLabels[page])}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p>
                    {page === "overview"
                      ? tr("Ваши расходы, привычки и немного спокойствия.")
                      : page === "tracker"
                        ? tr("Записывайте важное. Замечайте повседневное.")
                        : page === "shopping"
                          ? tr("Запланируйте продукты, а после покупки укажите цену — всё сохранится автоматически.")
                        : tr("Ваши настройки и данные — в одном месте.")}
                  </p>
                </div>
                <div className="header-actions">
                  {(page === "overview" || page === "tracker") && (
                    <>
                      <Button
                        className="export-button"
                        onClick={exportReport}
                        disabled={pdfBusy}
                      >
                        <Download size={17} />
                        {pdfBusy ? "…" : tr("Создать PDF")}
                      </Button>
                      <Button variant="primary" onClick={() => setModal("new")}>
                        <Plus size={19} />
                        {tr("Добавить расход")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {(page === "overview" || page === "tracker") && (
                <div className="period-bar">
                  <div className="month-control">
                    <button
                      className="icon-button"
                      onClick={() => shiftMonth(-1)}
                      aria-label={tr("Предыдущий месяц")}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <label className="month-picker">
                      <span>{monthLabel(month, language)}</span>
                      <input
                        type="month"
                        value={month}
                        min="1900-01"
                        max="2200-12"
                        aria-label={tr("Выбрать месяц")}
                        onChange={(e) => {
                          if (e.target.value) setMonth(e.target.value);
                        }}
                      />
                    </label>
                    <button
                      className="icon-button"
                      onClick={() => shiftMonth(1)}
                      aria-label={tr("Следующий месяц")}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                  <label className="currency-select">
                    <span>{tr("Валюта обзора")}</span>
                    <select
                      value={currency}
                      onChange={(e) =>
                        updateCurrency(e.target.value as Currency)
                      }
                      aria-label={tr("Валюта обзора")}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {page === "overview" && (
                <>
                  {streak.current === 0 && (
                    <section className="voyage-banner" aria-label="BeliLog">
                      <div className="voyage-copy">
                        <span className="voyage-kicker">
                          BeliLog · Grand Line Ledger
                        </span>
                        <strong>{tr("Навстречу своим сокровищам")}</strong>
                        <p>
                          {tr(
                            "Ваши финансы — ваше приключение. Следите за каждым бери и держите курс к своим целям.",
                          )}
                        </p>
                        <span className="voyage-meta">
                          <ShieldCheck size={13} />
                          {tr("Личный журнал · Без облака")}
                        </span>
                      </div>
                      <div className="voyage-art" aria-hidden="true">
                        <img src={`${import.meta.env.BASE_URL}belilog-icon-512.png`} alt="" />
                      </div>
                    </section>
                  )}
                  <StreakBounty
                    transactions={data.transactions}
                    profile={data.profile}
                    language={language}
                    variant="overview"
                    celebration={bountyCelebration?.page === "overview" ? bountyCelebration : null}
                    onAddExpense={() => setModal("new")}
                  />
                  {showDemoBanner && data.transactions.length === 0 && (
                    <div className="demo-banner">
                      <span className="demo-icon">
                        <Sparkles size={21} />
                      </span>
                      <div className="demo-copy">
                        <strong>
                          {tr("Место для ваших финансовых привычек")}
                        </strong>
                        <span>
                          {tr(
                            "Начните с первой покупки или посмотрите, как всё работает, на примере.",
                          )}
                        </span>
                      </div>
                      <button className="demo-link" onClick={startDemo}>
                        {tr("Посмотреть демо")} <ArrowUpRight size={16} />
                      </button>
                      <button
                        className="icon-button demo-dismiss"
                        aria-label={tr("Скрыть подсказку")}
                        onClick={() => setShowDemoBanner(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="overview-stats">
                    <div className="stat-card stat-card-featured">
                      <div className="stat-label">
                        {tr("Расходы за месяц")}
                        <span className="stat-icon">
                          <ArrowUpRight size={18} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {shortMoney(total, currency, language)}
                      </div>
                      <div className="stat-footer">
                        {changePercent !== null ? (
                          <>
                            <span
                              className={`stat-trend ${changePercent > 0 ? "trend-up" : ""}`}
                            >
                              {changePercent > 0 ? "+" : ""}
                              {Math.round(changePercent)}%
                            </span>
                            <span>{tr("к прошлому месяцу")}</span>
                          </>
                        ) : (
                          <>
                            <span className="tiny-dot" />
                            <span>
                              {transactions.length
                                ? `${transactions.length} ${plural(transactions.length, tr("запись"), tr("записи"), tr("записей"), language)} ${tr("за этот месяц")}`
                                : tr("Новый месяц — чистый лист")}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="stat-decoration" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        {budget
                          ? tr("Осталось в бюджете")
                          : tr("Месячный бюджет")}
                        <span className="stat-icon">
                          <Wallet size={18} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {budget ? (
                          shortMoney(remaining, currency, language)
                        ) : (
                          <span className="unset-value">{tr("Не задан")}</span>
                        )}
                      </div>
                      <div className="stat-footer">
                        {budget ? (
                          <>
                            <span
                              className={`mini-progress ${progress >= 100 ? "is-over" : ""}`}
                            >
                              <i
                                style={{ width: `${Math.min(progress, 100)}%` }}
                              />
                            </span>
                            <span>
                              {Math.round(progress)}
                              {tr("% использовано")}
                            </span>
                          </>
                        ) : (
                          <button
                            className="inline-link"
                            onClick={() => navigate("profile")}
                          >
                            {tr("Задать комфортный лимит")}{" "}
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">
                        {tr("В среднем за день")}
                        <span className="stat-icon">
                          <TrendingUp size={18} />
                        </span>
                      </div>
                      <div className="stat-value">
                        {shortMoney(average, currency, language)}
                      </div>
                      <div className="stat-footer">
                        <span className="stat-neutral-icon">
                          <ArrowDownLeft size={13} />
                        </span>
                        <span>
                          {elapsedDays
                            ? `${tr("За")} ${elapsedDays} ${plural(elapsedDays, tr("день"), tr("дня"), tr("дней"), language)} ${tr("месяца")}`
                            : tr("Месяц ещё не начался")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel chart-panel">
                      <div className="panel-header">
                        <div>
                          <h2>{tr("Динамика расходов")}</h2>
                          <p className="panel-subtitle">
                            {tr("Маленькие покупки складываются в картину")}
                          </p>
                        </div>
                        <div className="segment-control">
                          <button
                            className={
                              chartRange === "week" ? "segment-active" : ""
                            }
                            onClick={() => setChartRange("week")}
                          >
                            {tr("7 дней")}
                          </button>
                          <button
                            className={
                              chartRange === "month" ? "segment-active" : ""
                            }
                            onClick={() => setChartRange("month")}
                          >
                            {tr("Месяц")}
                          </button>
                        </div>
                      </div>
                      <ExpenseChart language={language}
                        transactions={transactions}
                        month={month}
                        range={chartRange}
                        currency={currency}
                      />
                      <div className="chart-legend">
                        <span
                          className="legend-dot"
                          style={{ background: "#C35D4C" }}
                        />
                        {tr("Расходы")}{" "}
                        <span className="chart-legend-note">
                          {chartRange === "week"
                            ? tr("Последние 7 дней выбранного месяца")
                            : tr("По дням месяца")}
                        </span>
                      </div>
                    </section>
                    <section className="panel category-panel">
                      <div className="panel-header">
                        <div>
                          <h2>{tr("Куда уходят деньги")}</h2>
                          <p className="panel-subtitle">
                            {tr("Всё по своим местам")}
                          </p>
                        </div>
                        <span className="muted-icon">
                          <ShoppingBag size={18} />
                        </span>
                      </div>
                      <div className="donut-wrap">
                        <svg
                          className="donut"
                          viewBox="0 0 180 180"
                          role="img"
                          aria-label={
                            total
                              ? tr("Распределение расходов по категориям")
                              : tr("Пока нет расходов по категориям")
                          }
                        >
                          <circle
                            cx="90"
                            cy="90"
                            r="71"
                            fill="none"
                            stroke="var(--track)"
                            strokeWidth="17"
                          />
                          {categories.map((c, i) => {
                            const offset = categories
                              .slice(0, i)
                              .reduce(
                                (s, item) => s + (item.value / total) * 446.1,
                                0,
                              );
                            return (
                              <circle
                                key={c.id}
                                cx="90"
                                cy="90"
                                r="71"
                                fill="none"
                                stroke={categoryColors[c.id]}
                                strokeWidth="17"
                                strokeDasharray={`${Math.max(0, (c.value / total) * 446.1 - 5)} ${446.1}`}
                                strokeDashoffset={-offset}
                                transform="rotate(-90 90 90)"
                              >
                                <title>
                                  {tr(c.label)}:{" "}
                                  {formatMoney(c.value, currency, language)}
                                </title>
                              </circle>
                            );
                          })}
                        </svg>
                        <div className="donut-center">
                          <span>{categories.length || "—"}</span>
                          <small>
                            {categories.length
                              ? plural(
                                  categories.length,
                                  tr("категория"),
                                  tr("категории"),
                                  tr("категорий"),
                                  language,
                                )
                              : tr("Всё впереди")}
                          </small>
                        </div>
                      </div>
                      <div className="legend-list">
                        {categories.length ? (
                          categories.slice(0, 4).map((c) => (
                            <div className="legend-row" key={c.id}>
                              <span
                                className="legend-dot"
                                style={{ background: categoryColors[c.id] }}
                              />
                              <span className="legend-name">{tr(c.label)}</span>
                              <span className="legend-value">
                                {formatMoney(c.value, currency, language)}
                              </span>
                              <span className="legend-percent">
                                {Math.round((c.value / total) * 100)}%
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="category-placeholder">
                            {tr("Добавьте расходы, и здесь появится")}
                            <br />
                            {tr("распределение по категориям.")}
                          </p>
                        )}
                        {categories.length > 4 && (
                          <button
                            className="inline-link more-categories"
                            onClick={() => navigate("tracker")}
                          >
                            {tr("Ещё")} {categories.length - 4}{" "}
                            {plural(
                              categories.length - 4,
                              tr("категория"),
                              tr("категории"),
                              tr("категорий"),
                              language,
                            )}{" "}
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </section>
                  </div>
                  <div className="dashboard-bottom">
                    <section className="panel recent-panel">
                      <div className="panel-header">
                        <div>
                          <h2>
                            {tr("Последние расходы")}{" "}
                            <span className="count-badge">
                              {transactions.length}
                            </span>
                          </h2>
                          <p className="panel-subtitle">
                            {tr("Из маленьких деталей состоит ваш день")}
                          </p>
                        </div>
                        <button
                          className="section-link"
                          onClick={() => {
                            setAllTime(false);
                            setSearch("");
                            setCategory("all");
                            setFilterCurrency("all");
                            navigate("tracker");
                          }}
                        >
                          {tr("Все расходы")} <ArrowRight size={16} />
                        </button>
                      </div>
                      {sortedTransactions.length ? (
                        <TransactionTable language={language} onOpen={setDetailId} onEdit={setModal} onDelete={deleteTransaction}
                          items={sortedTransactions.slice(0, 5)}
                          compact
                        />
                      ) : (
                        emptyState()
                      )}
                    </section>
                    <div className="budget-panel">
                      <span className="budget-icon">
                        <Wallet size={21} strokeWidth={1.6} />
                      </span>
                      <h2>{tr("С заботой о будущем")}</h2>
                      <p>
                        {budget
                          ? tr(
                              "Небольшой ориентир помогает принимать большие решения спокойнее.",
                            )
                          : tr(
                              "Задайте месячный бюджет, чтобы понимать, сколько ещё можно потратить.",
                            )}
                      </p>
                      {budget > 0 && (
                        <>
                          <div className="budget-values">
                            <strong>{Math.round(progress)}%</strong>
                            <span>
                              {tr("от")}{" "}
                              {formatMoney(budget, currency, language)}
                            </span>
                          </div>
                          <div
                            className={`budget-track ${progress >= 100 ? "is-over" : ""}`}
                          >
                            <div
                              className="budget-fill"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          <span className="budget-caption">
                            {progress >= 100
                              ? `${tr("Лимит превышен на")} ${formatMoney(total - budget, currency, language)}`
                              : `${tr("В запасе")} ${formatMoney(remaining, currency, language)}`}
                          </span>
                        </>
                      )}
                      <button
                        className="budget-link"
                        onClick={() => navigate("profile")}
                      >
                        {budget
                          ? tr("Настроить бюджет")
                          : tr("Установить бюджет")}
                        <ArrowUpRight size={16} />
                      </button>
                      <div className="budget-art" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                  <p className="workspace-footnote">
                    <ShieldCheck size={13} />
                    {tr(
                      "Только вы и ваши финансы. Данные хранятся в этом браузере.",
                    )}
                    <span title={tr(RATE_LABEL)}>
                      <CircleHelp size={13} />
                      {tr("Суммы в валюте обзора — по условному курсу.")}
                    </span>
                  </p>
                </>
              )}
              {page === "shopping" && (
                <ShoppingList
                  items={data.shoppingList ?? []}
                  transactions={data.transactions}
                  defaultCurrency={currency}
                  language={language}
                  onAdd={addPlannedItem}
                  onPriceChange={savePlannedPrice}
                  onUpdate={updatePlannedItem}
                  onRemove={removePlannedItem}
                />
              )}
              {page === "tracker" && (
                <>
                  <div className="tracker-summary">
                    <div>
                      <span>
                        {tr("Расходы")}{" "}
                        {allTime
                          ? tr("за всё время")
                          : tr("за выбранный месяц")}
                      </span>
                      <strong>
                        {formatMoney(
                          filtered.reduce(
                            (s, t) =>
                              s + convertAmount(t.amount, t.currency, currency),
                            0,
                          ),
                          currency,
                          language,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>{tr("Количество записей")}</span>
                      <strong>
                        {filtered.length}
                        <small>
                          {" "}
                          {plural(
                            filtered.length,
                            tr("расход"),
                            tr("расхода"),
                            tr("расходов"),
                            language,
                          )}
                        </small>
                      </strong>
                    </div>
                    <span className="tracker-summary-note">
                      <ShieldCheck size={18} />
                      {tr("Каждая запись — шаг к ясности")}
                    </span>
                  </div>
                  <section className="panel tracker-panel">
                    <div className="filter-bar">
                      <label className="search-field">
                        <Search size={18} />
                        <input
                          placeholder={tr("Найти покупку или заметку…")}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          aria-label={tr("Поиск расходов")}
                        />
                        {search && (
                          <button
                            className="icon-button"
                            aria-label={tr("Очистить поиск")}
                            onClick={() => setSearch("")}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </label>
                      <select
                        className="filter-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        aria-label={tr("Фильтр по категории")}
                      >
                        <option value="all">{tr("Все категории")}</option>
                        {CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {tr(c.label)}
                          </option>
                        ))}
                      </select>
                      <select
                        className="filter-select"
                        value={filterCurrency}
                        onChange={(e) => setFilterCurrency(e.target.value)}
                        aria-label={tr("Фильтр по валюте")}
                      >
                        <option value="all">{tr("Все валюты")}</option>
                        {CURRENCIES.map((c) => (
                          <option key={c.code}>{c.code}</option>
                        ))}
                      </select>
                      <select
                        className="filter-select sort-select"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        aria-label={tr("Сортировка расходов")}
                      >
                        <option value="newest">{tr("Сначала новые")}</option>
                        <option value="oldest">{tr("Сначала старые")}</option>
                        <option value="largest">{tr("По сумме ↓")}</option>
                      </select>
                    </div>
                    <div className="filter-summary">
                      <span>
                        {tr("Найдено записей:")}{" "}
                        <strong>{filtered.length}</strong>
                      </span>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={allTime}
                          onChange={(e) => setAllTime(e.target.checked)}
                        />
                        {tr("За всё время")}
                      </label>
                    </div>
                    {filtered.length ? (
                      <TransactionTable items={filtered} language={language} onOpen={setDetailId} onEdit={setModal} onDelete={deleteTransaction} paginationKey={JSON.stringify([search, category, filterCurrency, sort, month, allTime])} />
                    ) : (
                      emptyState(data.transactions.length > 0)
                    )}
                    <div className="table-footer">
                      <ShieldCheck size={14} />
                      <span>
                        {storageOk
                          ? tr("Все изменения сохраняются автоматически")
                          : tr(
                              "Хранилище недоступно. Скачайте резервную копию.",
                            )}
                      </span>
                      <button
                        className="inline-link"
                        onClick={exportReport}
                        disabled={pdfBusy}
                      >
                        <Download size={14} />
                        {tr("Создать PDF")}
                      </button>
                    </div>
                  </section>
                  <p className="workspace-footnote">
                    <CircleHelp size={13} />
                    {tr(
                      "Суммы покупок сохраняются в исходной валюте. Итог в",
                    )}{" "}
                    {currency} {tr("— по условному курсу.")}
                    <button
                      className="inline-link"
                      onClick={() => navigate("profile")}
                    >
                      {tr("О курсах")} <ArrowRight size={13} />
                    </button>
                  </p>
                </>
              )}
              {page === "profile" && (
                <div className="profile-grid">
                  <form
                    className="panel profile-form"
                    onSubmit={(e: FormEvent) => {
                      e.preventDefault();
                      const saved = setData((d) => mergeAppData({ ...d, profile: profileBase.current }, d, {
                        ...d,
                        profile: {
                          ...profile,
                          name: profile.name.trim() || "Пользователь",
                          email: profile.email.trim(),
                        },
                      }));
                      if (saved) setToast({ message: "Настройки профиля сохранены" });
                    }}
                  >
                    <div className="panel-header">
                      <div>
                        <h2>{tr("Личные настройки")}</h2>
                        <p className="panel-subtitle">
                          {tr("Пусть здесь всё будет по-вашему")}
                        </p>
                      </div>
                      <UserRound size={20} className="muted-icon" />
                    </div>
                    <div className="profile-identity">
                      <button
                        type="button"
                        className="profile-avatar profile-avatar-edit"
                        aria-label={tr("Редактировать аватар")}
                        title={tr("Редактировать аватар")}
                        onClick={() =>
                          data.profile.avatar
                            ? setAvatarSource({ src: data.profile.avatar })
                            : avatarRef.current?.click()
                        }
                      >
                        {data.profile.avatar ? (
                          <img
                            src={data.profile.avatar}
                            alt={tr("Аватар пользователя")}
                          />
                        ) : (
                          initials || tr("П")
                        )}
                        <span
                          className="profile-avatar-edit-icon"
                          aria-hidden="true"
                        >
                          <Camera size={13} />
                        </span>
                      </button>
                      <div>
                        <strong>
                          {data.profile.name === "Пользователь"
                            ? tr("Пользователь")
                            : data.profile.name}
                        </strong>
                        <span>{tr("Ваше личное финансовое пространство")}</span>
                      </div>
                      <span className="profile-local-badge">
                        {tr("Локальный профиль")}
                      </span>
                    </div>
                    <div className="avatar-editor">
                      <div className="avatar-editor-actions">
                        <Button onClick={() => avatarRef.current?.click()}>
                          <Camera size={15} />
                          {tr("Сменить аватар")}
                        </Button>
                        {data.profile.avatar && (
                          <Button
                            onClick={() =>
                              setAvatarSource({ src: data.profile.avatar })
                            }
                          >
                            <Pencil size={15} />
                            {tr("Редактировать аватар")}
                          </Button>
                        )}
                        {data.profile.avatar && (
                          <Button
                            onClick={() => {
                              const saved = setData((d) => ({
                                ...d,
                                profile: { ...d.profile, avatar: undefined },
                              }));
                              if (saved) setProfile((p) => ({ ...p, avatar: undefined }));
                            }}
                          >
                            <Trash2 size={15} />
                            {tr("Удалить аватар")}
                          </Button>
                        )}
                      </div>
                      <span className="field-hint">
                        {tr(
                          "Переместите и увеличьте фото перед сохранением. PNG, JPG или WebP до 8 МБ.",
                        )}
                      </span>
                      <input
                        className="sr-only"
                        ref={avatarRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label={tr("Выбрать аватар")}
                        onChange={(e) => {
                          selectAvatar(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <div className="form-row">
                      <label className="field">
                        <span className="field-label">
                          {tr("Как к вам обращаться")}
                        </span>
                        <input
                          className="form-input"
                          required
                          maxLength={60}
                          value={profile.name}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder={tr("Ваше имя")}
                        />
                      </label>
                      <label className="field">
                        <span className="field-label">
                          Email <small>{tr("необязательно")}</small>
                        </span>
                        <input
                          className="form-input"
                          type="email"
                          maxLength={254}
                          value={profile.email}
                          onChange={(e) =>
                            setProfile((p) => ({ ...p, email: e.target.value }))
                          }
                          placeholder="you@example.com"
                        />
                        <span className="field-hint">
                          {tr("Только заметка в профиле, без рассылок.")}
                        </span>
                      </label>
                    </div>
                    <div className="settings-group">
                      <h3>{tr("Ваш финансовый ориентир")}</h3>
                      <p className="field-hint">
                        {tr(
                          "Лимит применяется к каждому месяцу. Его можно менять в любой момент.",
                        )}
                      </p>
                      <div className="form-row">
                        <label className="field">
                          <span className="field-label">
                            {tr("Основная валюта")}
                          </span>
                          <select
                            className="form-input"
                            value={profile.currency}
                            onChange={(e) => {
                              const next = e.target.value as Currency;
                              try {
                                const monthlyBudget = convertedBudget(profile.monthlyBudget, profile.currency, next);
                                setProfile((p) => ({ ...p, currency: next, monthlyBudget }));
                              } catch (cause) {
                                setToast({ message: (cause as Error).message, error: true });
                              }
                            }}
                          >
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code} — {tr(c.label)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          <span className="field-label">
                            {tr("Бюджет на месяц")}
                          </span>
                          <div className="input-prefix">
                            <input
                              className="form-input"
                              type="number"
                              min="0"
                              max="1000000000000"
                              step="0.01"
                              value={profile.monthlyBudget || ""}
                              onChange={(e) =>
                                setProfile((p) => ({
                                  ...p,
                                  monthlyBudget: Number(e.target.value),
                                }))
                              }
                              placeholder="0"
                            />
                            <span>{profile.currency}</span>
                          </div>
                        </label>
                      </div>
                      <div className="rates-note">
                        <CircleHelp size={16} />
                        <p>
                          <strong>
                            {tr("Для общей картины — условные курсы")}
                          </strong>
                          <span>
                            {tr(RATE_LABEL)}
                            {tr(
                              ". Они не обновляются автоматически. Каждая покупка хранится в своей валюте.",
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="settings-group">
                      <h3>{tr("Больше света или глубины?")}</h3>
                      <p className="field-hint">
                        {tr("Выберите комфортное оформление.")}
                      </p>
                      <div className="theme-options">
                        {(
                          [
                            { id: "light", label: tr("Светлая"), icon: Sun },
                            { id: "dark", label: tr("Тёмная"), icon: Moon },
                            {
                              id: "system",
                              label: tr("Как в системе"),
                              icon: Monitor,
                            },
                          ] as const
                        ).map((t) => (
                          <button
                            type="button"
                            key={t.id}
                            className={`theme-option ${profile.theme === t.id ? "selected" : ""}`}
                            onClick={() => {
                              setProfile((p) => ({ ...p, theme: t.id }));
                            }}
                          >
                            <t.icon size={21} />
                            <span>{tr(t.label)}</span>
                            {profile.theme === t.id && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="settings-group">
                      <h3>{tr("Язык интерфейса")}</h3>
                      <p className="field-hint">
                        {tr("Выберите язык. Настройка сохраняется сразу.")}
                      </p>
                      <label className="field">
                        <span className="field-label">
                          {tr("Язык интерфейса")}
                        </span>
                        <select
                          className="form-input"
                          value={language}
                          onChange={(event) => {
                            const next = event.target.value as Language;
                            const saved = setData((current) => ({
                              ...current,
                              profile: { ...current.profile, language: next },
                            }));
                            if (saved) setProfile((draft) => ({
                              ...draft,
                              language: next,
                            }));
                          }}
                        >
                          <option value="ru">{tr("Русский")}</option>
                          <option value="en">{tr("Английский")}</option>
                        </select>
                      </label>
                    </div>
                    <div className="profile-save">
                      {storageError && <Button onClick={() => {
                        profileBase.current = data.profile;
                        setProfile(data.profile);
                      }}>{tr("Загрузить актуальный профиль")}</Button>}
                      <span>
                        <ShieldCheck size={14} />
                        {tr("Все настройки сохраняются автоматически.")}
                      </span>
                      <Button variant="primary" type="submit">
                        <Check size={17} />
                        {tr("Сохранить настройки")}
                      </Button>
                    </div>
                  </form>
                  <div className="profile-right">
                    <section className="panel storage-card">
                      <div className="storage-illustration">
                        <ShieldCheck size={32} strokeWidth={1.3} />
                        <span className="storage-orbit orbit-one" />
                        <span className="storage-orbit orbit-two" />
                      </div>
                      <h2>
                        {tr("Ваши данные.")}
                        <br />
                        {tr("В ваших руках.")}
                      </h2>
                      <p>
                        {tr(
                          "Без аккаунтов и облака. Все записи хранятся в браузере на этом устройстве.",
                        )}
                      </p>
                      <div className="storage-details">
                        <div>
                          <span>{tr("Всего записей")}</span>
                          <strong>{data.transactions.length}</strong>
                        </div>
                        <div>
                          <span>{tr("Размер данных")}</span>
                          <strong>
                            {(
                              new Blob([JSON.stringify(data)]).size / 1024
                            ).toFixed(1)}{" "}
                            {tr("КБ")}
                          </strong>
                        </div>
                        <div>
                          <span>{tr("Состояние")}</span>
                          <strong
                            className={
                              storageOk ? "storage-good" : "storage-error"
                            }
                          >
                            {storageOk
                              ? tr("Сохранено")
                              : tr("Ошибка сохранения")}
                          </strong>
                        </div>
                      </div>
                      <div className="storage-actions">
                        <Button onClick={exportBackup}>
                          <Download size={16} />
                          {tr("PDF-копия со всеми данными")}
                        </Button>
                        <Button onClick={() => importRef.current?.click()}>
                          <Upload size={16} />
                          {tr("Импортировать PDF-копию")}
                        </Button>
                        <input
                          ref={importRef}
                          type="file"
                          accept=".pdf,application/pdf,.json,application/json"
                          aria-label={tr("Импортировать PDF-копию")}
                          className="sr-only"
                          onChange={(e) => {
                            void importBackup(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      <p className="field-hint">
                        {tr(
                          "PDF со всеми записями, списком покупок, аватаром и настройками. Подходит для восстановления.",
                        )}
                      </p>
                    </section>
                    <section className="panel demo-card">
                      <Sparkles size={19} />
                      <div>
                        <h3>{tr("Попробовать на примере")}</h3>
                        <p>{tr("Демо с расходами, категориями и бюджетом.")}</p>
                      </div>
                      <button
                        className="icon-button"
                        onClick={startDemo}
                        aria-label={tr("Загрузить демо")}
                      >
                        <ArrowUpRight size={20} />
                      </button>
                    </section>
                    <div className="data-danger-zone">
                      <button onClick={() => setConfirmation("reset")}>
                        <Trash2 size={15} />
                        {tr("Удалить все данные")}
                      </button>
                      <p>
                        {tr("Удаляет профиль, расходы и список покупок из этого браузера.")}
                      </p>
                    </div>
                  </div>
                  <StreakBounty
                    transactions={data.transactions}
                    profile={data.profile}
                    language={language}
                    variant="profile"
                    celebration={bountyCelebration?.page === "profile" ? bountyCelebration : null}
                    onAddExpense={() => setModal("new")}
                  />
                  <ActivityCalendar
                    transactions={data.transactions}
                    language={language}
                  />
                </div>
              )}
            </div>
          </main>
        </div>
        {avatarSource && (
          <Modal
            className="avatar-crop-modal"
            label={tr("Редактор аватара")}
            onClose={() => setAvatarSource(null)}
          >
            <AvatarCropper
              {...avatarSource}
              language={language}
              onSave={saveAvatar}
              onClose={() => setAvatarSource(null)}
            />
          </Modal>
        )}
        {detailRecord && !modal && (
          <Modal className="detail-modal" onClose={() => setDetailId(null)}>
            <EntryDetails
              transaction={detailRecord}
              language={language}
              onClose={() => setDetailId(null)}
              onEdit={() => {
                setModal(detailRecord);
                setDetailId(null);
              }}
              onExport={() => {
                void downloadPdf([detailRecord]);
              }}
              onChange={(value) => {
                return Boolean(setData((d) => {
                  const record = mergeTransactionDraft(detailRecord, d.transactions.find((t) => t.id === value.id), value);
                  return { ...d, transactions: d.transactions.map((t) => t.id === value.id ? record : t) };
                }));
              }}
            />
          </Modal>
        )}
        {pendingImport && (
          <Modal onClose={() => setPendingImport(null)}>
            <div className="dialog-header">
              <div>
                <span className="dialog-eyebrow">BeliLog · PDF</span>
                <h2>{tr("Копия проверена")}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label={tr("Закрыть")}
                onClick={() => setPendingImport(null)}
              >
                <X size={20} />
              </button>
            </div>
            <p className="modal-description">
              {tr(
                "Выберите, как восстановить данные. Текущие записи можно объединить с копией.",
              )}
            </p>
            <p className="field-hint">
              {tr(
                "Восстановить всё заменит текущие расходы, список покупок, профиль и настройки.",
              )}
            </p>
            <div className="import-summary">
              <strong>{pendingImport.transactions.length}</strong>{" "}
              {tr("записей")} · {pendingImport.profile.name}
              {Boolean(pendingImport.shoppingList?.length) && <span> · {tr("Список покупок")}: {pendingImport.shoppingList!.length}</span>}
            </div>
            <div className="import-actions">
              <Button onClick={() => restoreBackup(false)}>
                <Plus size={16} />
                {tr("Добавить записи")}
              </Button>
              <Button variant="primary" onClick={() => restoreBackup(true)}>
                <Upload size={16} />
                {tr("Восстановить всё")}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setPendingImport(null)}>
              {tr("Отмена")}
            </Button>
          </Modal>
        )}
        {modal && (
          <TransactionDialog
            key={modal === "new" ? "new" : JSON.stringify(modal)}
            value={modal === "new" ? null : modal}
            defaultCurrency={currency}
            onClose={() => setModal(null)}
            onSave={saveTransaction}
            onReload={modal === "new" ? undefined : () => {
              const current = data.transactions.find((t) => t.id === modal.id);
              setModal(current ?? null);
            }}
          />
        )}
        {confirmation && (
          <Modal onClose={() => setConfirmation(null)}>
            <div className="dialog-header">
              <div>
                <span className="dialog-eyebrow">
                  {confirmation === "reset"
                    ? tr("УПРАВЛЕНИЕ ДАННЫМИ")
                    : tr("ПОПРОБОВАТЬ НА ПРИМЕРЕ")}
                </span>
                <h2>
                  {confirmation === "recovery" ? tr("Восстановить последнюю копию?") : confirmation === "reset"
                    ? tr("Начать с чистого листа?")
                    : tr("Загрузить демо?")}
                </h2>
              </div>
              <button
                className="icon-button modal-close"
                onClick={() => setConfirmation(null)}
                aria-label={tr("Закрыть")}
              >
                <X size={20} />
              </button>
            </div>
            <p className="modal-description">
              {confirmation === "recovery" ? tr("Повреждённые данные будут сохранены отдельно. Рабочая копия снова станет доступна для изменений.") : confirmation === "reset"
                ? tr(
                    "Все расходы, список покупок и настройки будут удалены из этого браузера. Перед удалением можно скачать резервную копию.",
                  )
                : tr(
                    "Демо заменит текущие расходы, список покупок и настройки. Скачайте копию, чтобы вернуться к своим данным.",
                  )}
            </p>
            <div className="confirmation-backup">
              <Button onClick={exportBackup}>
                <Download size={16} />
                {tr("Скачать копию перед заменой")}
              </Button>
            </div>
            <div className="dialog-footer">
              <Button onClick={() => setConfirmation(null)}>
                {tr("Отмена")}
              </Button>
              <Button
                variant={confirmation === "reset" ? "danger" : "primary"}
                onClick={() => {
                  if (confirmation === "recovery") {
                    if (!commit(data, true)) return;
                    setConfirmation(null);
                    setToast({ message: "Копия восстановлена" });
                  } else if (confirmation === "reset") {
                    setBountyCelebration(null);
                    if (!commit(createEmptyData(), true)) return;
                    setProfile(createEmptyData().profile);
                    setMonth(currentMonth());
                    setSearch("");
                    setCategory("all");
                    setFilterCurrency("all");
                    setShowDemoBanner(true);
                    setConfirmation(null);
                    setToast({
                      message: "Данные удалены. Можно начать заново.",
                    });
                  } else applyDemo();
                }}
              >
                {confirmation === "recovery" ? tr("Восстановить копию") : confirmation === "reset"
                  ? tr("Удалить все данные")
                  : tr("Загрузить демо")}
              </Button>
            </div>
          </Modal>
        )}
        {toast && (
          <div
            className={`toast ${toast.error ? "toast-error" : ""} ${toast.pirate ? "toast--pirate" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            {toast.error ? <CircleHelp size={19} /> : toast.pirate ? <Sparkles size={19} /> : <CheckCheck size={19} />}
            <span>{tr(toast.message)}</span>
            {toast.undo && (
              <button className="toast-action" onClick={toast.undo}>
                {tr("Вернуть")}
              </button>
            )}
            <button
              className="toast-close icon-button"
              onClick={() => setToast(null)}
              aria-label={tr("Закрыть уведомление")}
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </LanguageProvider>
  );
}

function plural(
  n: number,
  one: string,
  few: string,
  many: string,
  language: Language = "ru",
) {
  if (language === "en") return Math.abs(n) === 1 ? one : many;
  const v = Math.abs(n) % 100;
  return v >= 11 && v <= 19
    ? many
    : v % 10 === 1
      ? one
      : v % 10 >= 2 && v % 10 <= 4
        ? few
        : many;
}
function Modal({
  children,
  onClose,
  className = "",
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  label?: string;
}) {
  const { tr } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const target =
        ref.current?.querySelector<HTMLElement>("input") ??
        ref.current?.querySelector<HTMLElement>("button");
      target?.focus();
    });
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
          ) ?? [],
        );
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handle);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? tr("Управление расходами")}
        ref={ref}
      >
        {children}
      </div>
    </div>
  );
}
function TransactionDialog({
  value,
  defaultCurrency,
  onClose,
  onSave,
  onReload,
}: {
  value: Transaction | null;
  defaultCurrency: Currency;
  onClose: () => void;
  onSave: (value: Transaction) => true | string;
  onReload?: () => void;
}) {
  const { language, tr } = useI18n();
  const [title, setTitle] = useState(value?.title ?? "");
  const [amount, setAmount] = useState(value?.amount.toString() ?? "");
  const [currency, setCurrency] = useState<Currency>(
    value?.currency ?? defaultCurrency,
  );
  const [category, setCategory] = useState<CategoryId>(
    value?.category ?? "food",
  );
  const [date, setDate] = useState(value?.date ?? todayString());
  const [note, setNote] = useState(value?.note ?? "");
  const [error, setError] = useState("");
  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const numeric = value && amount === String(value.amount) ? value.amount : parseMoney(amount);
          if (
            !title.trim() ||
            numeric === null ||
            numeric <= 0 ||
            numeric > 1e12 ||
            !date ||
            date < "1900-01-01" ||
            date > "2200-12-31"
          ) {
            setError(
              "Укажите название, корректную дату и сумму не меньше 0,01.",
            );
            return;
          }
          if (
            value &&
            Math.round(getItemTotal(value) * 100) > Math.round(numeric * 100)
          ) {
            setError(
              "Общая сумма меньше суммы покупок внутри записи. Сначала измените состав.",
            );
            return;
          }
          const result = onSave({
            ...value,
            createdAt: value ? value.createdAt : todayString(),
            id:
              value?.id ??
              globalThis.crypto?.randomUUID?.() ??
              `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            title: title.trim(),
            amount: Math.round(numeric * 100) / 100,
            currency,
            category,
            date,
            note: value && note === (value.note ?? "") ? value.note : note.trim(),
          });
          if (result !== true) setError(result);
        }}
      >
        <div className="dialog-header">
          <div>
            <span className="dialog-eyebrow">
              {tr("ЕЩЁ ОДНА ДЕТАЛЬ В ОБЩЕЙ КАРТИНЕ")}
            </span>
            <h2>
              {value ? tr("Изменить расход") : tr("Новый расход")}
              <span className="heading-dot">.</span>
            </h2>
          </div>
          <button
            type="button"
            className="icon-button modal-close"
            aria-label={tr("Закрыть")}
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="form-grid">
          <label className="field full-width">
            <span className="field-label">{tr("На что потратили?")}</span>
            <input
              autoFocus
              className="form-input"
              placeholder={tr("Например, кофе и круассан")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label className="field amount-field">
            <span className="field-label">{tr("Сумма")}</span>
            <input
              className="form-input amount-input"
              type="text"
              inputMode="decimal"
              placeholder={language === "en" ? "0.00" : "0,00"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              maxLength={18}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{tr("Валюта")}</span>
            <select
              className="form-input currency-input"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field full-width category-fieldset">
            <legend className="field-label">{tr("Категория")}</legend>
            <div className="category-picker">
              {CATEGORIES.map((c) => {
                const Icon = categoryIcons[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`category-option ${category === c.id ? "is-selected" : ""}`}
                    onClick={() => setCategory(c.id)}
                    aria-pressed={category === c.id}
                  >
                    <Icon size={17} />
                    <span>{tr(c.label)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="field full-width">
            <span className="field-label">{tr("Дата покупки")}</span>
            <input
              type="date"
              className="form-input"
              value={date}
              min="1900-01-01"
              max="2200-12-31"
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field full-width">
            <span className="field-label">
              {tr("Заметка")} <small>{tr("необязательно")}</small>
            </span>
            <textarea
              className="form-input"
              rows={2}
              maxLength={500}
              placeholder={tr("Что-нибудь, что стоит запомнить…")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {tr(error)}
          </p>
        )}
        {error && onReload && <Button onClick={onReload}>{tr("Загрузить актуальную запись")}</Button>}
        <div className="dialog-footer">
          <span className="dialog-save-hint">
            <ShieldCheck size={14} />
            {tr("Только на вашем устройстве")}
          </span>
          <Button onClick={onClose}>{tr("Отмена")}</Button>
          <Button variant="primary" type="submit">
            <Check size={17} />
            {value ? tr("Сохранить") : tr("Добавить расход")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
