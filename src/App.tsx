import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownLeft,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  LayoutDashboard,
  Compass,
  ListChecks,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import {
  CURRENCIES,
  MAX_AMOUNT,
  MAX_TRANSACTIONS,
  convertAmount,
  createDemoData,
  createEmptyData,
  todayString,
  validateBackup,
} from "./lib/finance";
import type { AppData, Currency, Transaction } from "./lib/finance";

import { useProfileDraft } from "./lib/useProfileDraft";
import { usePersistentData } from "./lib/usePersistentData";
import {
  DataConflictError,
  mergeProfileDraft,
  mergeTransactionDraft,
} from "./lib/storage";
import {
  filterExpenses,
  indexExpenseText,
  orderExpenses,
  summarizeExpenses,
} from "./lib/expenses";
import FeatureBoundary from "./components/FeatureBoundary";
import LoadingState from "./components/LoadingState";
import Button from "./components/Button";
import Modal from "./components/Modal";
const TransactionDialog = lazy(() => import("./components/TransactionDialog"));
const OverviewPage = lazy(() => import("./pages/OverviewPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const TrackerPage = lazy(() => import("./pages/TrackerPage"));
const EntryDetails = lazy(() => import("./components/EntryDetails"));
const AvatarCropper = lazy(() => import("./components/AvatarCropper"));
const ShoppingList = lazy(() => import("./components/ShoppingList"));
import type { ShoppingPurchaseConfirmation } from "./components/ShoppingList";
import {
  addShoppingItem,
  confirmShoppingPurchase,
  removeShoppingItem,
  saveShoppingPrice,
  updateShoppingItem,
} from "./lib/shopping";
import StreakBadge from "./components/StreakBadge";
import { useStreakStats } from "./lib/useStreakStats";
import type { BountyCelebration } from "./components/StreakBounty";
import { getStreakStats } from "./lib/streak";
import { getStreakIncrease } from "./lib/pirateRanks";
import { LanguageProvider, translate } from "./lib/i18n";
import type { Language } from "./lib/finance";

type Page = "overview" | "tracker" | "shopping" | "profile";
type Toast = {
  message: string;
  error?: boolean;
  undo?: () => void;
  pirate?: boolean;
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
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function readPage(): Page {
  const value = window.location.hash.slice(1);
  return value === "tracker" || value === "shopping" || value === "profile"
    ? value
    : "overview";
}
function createRecordId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
export default function App() {
  const {
    data,
    commit,
    status: storageStatus,
    error: storageError,
    lastError,
  } = usePersistentData();
  const storageOk =
    !storageError && (storageStatus === "ready" || storageStatus === "empty");
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
  const [confirmation, setConfirmation] = useState<
    "reset" | "demo" | "recovery" | null
  >(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [avatarSource, setAvatarSource] = useState<{
    file?: File;
    src?: string;
  } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [bountyCelebration, setBountyCelebration] = useState<
    (BountyCelebration & { page: Page }) | null
  >(null);
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [chartRange, setChartRange] = useState<"month" | "week">("month");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [sort, setSort] = useState("newest");
  const [allTime, setAllTime] = useState(false);
  const {
    profile,
    setProfile,
    flushProfile,
    reloadProfile,
    commitProfileFields,
  } = useProfileDraft(data.profile, page === "profile", (base, draft) => {
    const saved = setData((current) => ({
      ...current,
      profile: mergeProfileDraft(base, current.profile, draft),
    }));
    return saved?.profile ?? null;
  });
  const currency = data.profile.currency;
  const detailRecord = detailId
    ? data.transactions.find((t) => t.id === detailId)
    : undefined;
  const latest = useRef({ data, profile, page });
  latest.current = { data, profile, page };
  const analyticsEnabled = page === "overview" || page === "tracker";
  const summary = useMemo(
    () =>
      summarizeExpenses(
        analyticsEnabled ? data.transactions : [],
        month,
        currency,
      ),
    [data.transactions, month, currency, analyticsEnabled],
  );
  const { transactions } = summary;
  const deferredSearch = useDeferredValue(search);
  const hasQuery = Boolean(deferredSearch);
  const searchIndex = useMemo(
    () =>
      indexExpenseText(hasQuery && page === "tracker" ? data.transactions : []),
    [data.transactions, hasQuery, page],
  );
  const ordered = useMemo(
    () =>
      orderExpenses(
        page === "tracker" ? (allTime ? data.transactions : transactions) : [],
        sort,
        currency,
      ),
    [page, allTime, data.transactions, transactions, sort, currency],
  );
  const filtered = useMemo(
    () =>
      filterExpenses(
        ordered,
        deferredSearch,
        category,
        filterCurrency,
        searchIndex,
      ),
    [ordered, deferredSearch, category, filterCurrency, searchIndex],
  );

  useEffect(() => {
    if (storageError) setToast({ message: storageError, error: true });
  }, [storageError]);

  useEffect(() => {
    const handler = () => {
      flushProfile();
      setPage(readPage());
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [flushProfile]);
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
    const timer = setTimeout(
      () => setBountyCelebration(null),
      Math.max(0, bountyCelebration.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [bountyCelebration]);
  useEffect(() => {
    // Navigation must not replay a reward on a newly mounted poster.
    setBountyCelebration(null);
  }, [page]);
  useEffect(() => {
    if (
      bountyCelebration &&
      (!streak.activeToday || streak.current !== bountyCelebration.toDays)
    ) {
      setBountyCelebration(null);
    }
  }, [streak.activeToday, streak.current, bountyCelebration]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function navigate(next: Page) {
    flushProfile();
    setPage(next);
    window.location.hash = next;
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  function shiftMonth(direction: number) {
    const next = new Date(`${month}-01T12:00:00`);
    next.setMonth(next.getMonth() + direction);
    setMonth(localDate(next).slice(0, 7));
  }
  function updateCurrency(next: Currency) {
    try {
      const monthlyBudget = convertedBudget(
        profile.monthlyBudget,
        profile.currency,
        next,
      );
      commitProfileFields({ currency: next, monthlyBudget });
    } catch (cause) {
      setToast({ message: (cause as Error).message, error: true });
    }
  }
  function convertedBudget(amount: number, from: Currency, to: Currency) {
    const converted = Math.round(convertAmount(amount, from, to) * 100) / 100;
    if (!Number.isFinite(converted) || converted > MAX_AMOUNT) {
      throw new Error(
        "После смены валюты бюджет превышает допустимый максимум. Сначала уменьшите бюджет.",
      );
    }
    return converted;
  }
  function saveTransaction(value: Transaction) {
    const editing = modal !== "new";
    const now = new Date();
    const currentTransactions = latest.current.data.transactions;
    const increase = editing
      ? null
      : getStreakIncrease(
          getStreakStats(currentTransactions, now),
          getStreakStats([value, ...currentTransactions], now),
        );
    const saved = setData((d) => {
      if (!editing && d.transactions.length >= MAX_TRANSACTIONS)
        throw new Error("В журнале может быть не больше 50 000 записей.");
      const record =
        editing && modal
          ? mergeTransactionDraft(
              modal,
              d.transactions.find((t) => t.id === value.id),
              value,
            )
          : value;
      return {
        ...d,
        transactions: editing
          ? d.transactions.map((t) => (t.id === value.id ? record : t))
          : [record, ...d.transactions],
      };
    });
    if (!saved) return lastError.current;
    setMonth(value.date.slice(0, 7));
    setModal(null);
    setBountyCelebration(
      increase
        ? {
            ...increase,
            id: value.id,
            expiresAt: Date.now() + 6000,
            page,
          }
        : null,
    );
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
  function commitShoppingChange(
    change: (current: AppData) => AppData,
  ): AppData | null {
    return setData(change);
  }
  function addPlannedItem(title: string, itemCurrency: Currency): boolean {
    return Boolean(
      commitShoppingChange((current) =>
        addShoppingItem(current, {
          id: createRecordId(),
          title,
          currency: itemCurrency,
          createdAt: todayString(),
        }),
      ),
    );
  }
  function checkShoppingBase(
    current: AppData,
    id: string,
    base: Transaction | null | undefined,
    patch: Partial<Transaction>,
  ) {
    if (base === undefined) return;
    const row = current.shoppingList?.find((item) => item.id === id);
    if (!row) throw new DataConflictError();
    const record = current.transactions.find((t) => t.id === row.transactionId);
    if ((record?.id ?? null) !== (base?.id ?? null))
      throw new DataConflictError();
    if (record && base)
      for (const field of Object.keys(patch) as (keyof Transaction)[]) {
        if (record[field] !== base[field] && record[field] !== patch[field])
          throw new DataConflictError();
      }
  }
  function updatePlannedItem(
    id: string,
    patch: { title?: string; currency?: Currency },
    base?: Transaction | null,
  ): boolean {
    return Boolean(
      commitShoppingChange((current) => {
        checkShoppingBase(current, id, base, patch);
        return updateShoppingItem(current, id, patch);
      }),
    );
  }
  function savePlannedPrice(
    id: string,
    amount: number,
    itemCurrency: Currency,
    base?: Transaction | null,
    changed?: { amount?: number; currency?: Currency },
  ): boolean {
    const previous = latest.current.data;
    const now = new Date();
    const eventId = createRecordId();
    const next = commitShoppingChange((current) => {
      checkShoppingBase(
        current,
        id,
        base,
        changed ?? { amount, currency: itemCurrency },
      );
      const row = current.shoppingList?.find((item) => item.id === id);
      const record = current.transactions.find(
        (t) => t.id === row?.transactionId,
      );
      return saveShoppingPrice(
        current,
        id,
        changed && changed.amount === undefined && record
          ? record.amount
          : amount,
        changed && changed.currency === undefined && record
          ? record.currency
          : itemCurrency,
        eventId,
        now,
      );
    });
    if (!next) return false;
    const increase =
      next.transactions.length > previous.transactions.length
        ? getStreakIncrease(
            getStreakStats(previous.transactions, now),
            getStreakStats(next.transactions, now),
          )
        : null;
    setBountyCelebration(
      increase
        ? { ...increase, id: eventId, expiresAt: Date.now() + 6000, page }
        : null,
    );
    if (increase?.promoted) {
      setToast({
        message: `${language === "en" ? "New pirate rank" : "Новый пиратский ранг"}: ${increase.rank.name[language]}!`,
        pirate: true,
      });
    }
    return true;
  }
  function removePlannedItem(id: string): boolean {
    return Boolean(
      commitShoppingChange((current) => removeShoppingItem(current, id)),
    );
  }
  function confirmPlannedPurchase(
    id: string,
    purchase: ShoppingPurchaseConfirmation,
  ): boolean {
    const previous = latest.current.data;
    const now = new Date();
    const eventId = createRecordId();
    const next = commitShoppingChange((current) => {
      checkShoppingBase(current, id, purchase.base, purchase.changed);
      const row = current.shoppingList?.find((item) => item.id === id);
      const record = current.transactions.find(
        (t) => t.id === row?.transactionId,
      );
      return confirmShoppingPurchase(
        current,
        id,
        purchase.changed.amount === undefined && record
          ? record.amount
          : purchase.amount,
        purchase.changed.currency === undefined
          ? (record?.currency ?? row?.currency ?? purchase.currency)
          : purchase.currency,
        eventId,
        now,
        purchase.changed.title === undefined
          ? undefined
          : { title: purchase.title },
      );
    });
    if (!next) return false;
    const increase =
      next.transactions.length > previous.transactions.length
        ? getStreakIncrease(
            getStreakStats(previous.transactions, now),
            getStreakStats(next.transactions, now),
          )
        : null;
    setBountyCelebration(
      increase
        ? { ...increase, id: eventId, expiresAt: Date.now() + 6000, page }
        : null,
    );
    setToast({
      message: increase?.promoted
        ? `${tr("Покупка подтверждена. Расход сохранён.")} ${language === "en" ? "New pirate rank" : "Новый пиратский ранг"}: ${increase.rank.name[language]}!`
        : tr("Покупка подтверждена. Расход сохранён."),
      pirate: increase?.promoted,
    });
    return true;
  }
  function deleteTransaction(transaction: Transaction) {
    setBountyCelebration(null);
    const linkedItems = new Set(
      latest.current.data.shoppingList
        ?.filter((item) => item.transactionId === transaction.id)
        .map((item) => item.id),
    );
    const saved = setData((d) => ({
      ...d,
      transactions: d.transactions.filter((t) => t.id !== transaction.id),
      ...(d.shoppingList
        ? {
            shoppingList: d.shoppingList.map((item) => {
              if (item.transactionId !== transaction.id) return item;
              const { transactionId: _removed, ...pending } = item;
              return pending;
            }),
          }
        : {}),
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
                ...(d.shoppingList
                  ? {
                      shoppingList: d.shoppingList.map((item) =>
                        linkedItems.has(item.id) && !item.transactionId
                          ? { ...item, transactionId: transaction.id }
                          : item,
                      ),
                    }
                  : {}),
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
    const report =
      page === "tracker" && search !== deferredSearch
        ? filterExpenses(
            ordered,
            search,
            category,
            filterCurrency,
            hasQuery ? searchIndex : indexExpenseText(data.transactions),
          )
        : filtered;
    void downloadPdf(page === "tracker" ? report : transactions);
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
        const linkedExpenses = new Set(
          shoppingList.flatMap((item) =>
            item.transactionId ? [item.transactionId] : [],
          ),
        );
        for (const item of pendingImport.shoppingList ?? []) {
          if (
            shoppingIds.has(item.id) ||
            (item.transactionId && linkedExpenses.has(item.transactionId))
          )
            continue;
          shoppingList.push(item);
          shoppingIds.add(item.id);
          if (item.transactionId) linkedExpenses.add(item.transactionId);
        }
        if (shoppingList.length > 1000) {
          throw new Error(
            "В списке покупок может быть не больше 1000 товаров.",
          );
        }
        return {
          ...current,
          transactions,
          ...(current.shoppingList || pendingImport.shoppingList
            ? { shoppingList }
            : {}),
        };
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
    if (!commitProfileFields({ avatar })) return;
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
    commitProfileFields({ theme: dark ? "light" : "dark" });
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
              <img
                src={`${import.meta.env.BASE_URL}belilog-icon-512.png`}
                alt=""
              />
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
                {
                  id: "overview",
                  label: tr("Обзор"),
                  shortLabel: tr("Обзор"),
                  icon: LayoutDashboard,
                },
                {
                  id: "tracker",
                  label: tr("Трекер расходов"),
                  shortLabel: tr("Трекер"),
                  icon: Wallet,
                },
                {
                  id: "shopping",
                  label: tr("Список покупок"),
                  shortLabel: tr("Покупки"),
                  icon: ListChecks,
                },
                {
                  id: "profile",
                  label: tr("Мой профиль"),
                  shortLabel: tr("Профиль"),
                  icon: UserRound,
                },
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
                <span className="nav-label">
                  <span className="nav-label-full">{item.label}</span>
                  <span className="nav-label-short">{item.shortLabel}</span>
                </span>
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
                    {tr(
                      storageStatus === "corrupt" ||
                        storageStatus === "recovered"
                        ? "Обнаружены повреждённые данные. Исходная копия сохранена."
                        : "Не удалось сохранить изменения в браузере.",
                    )}
                  </strong>
                  <p>
                    {tr(
                      storageError ||
                        (storageStatus === "corrupt" ||
                        storageStatus === "recovered"
                          ? "Автосохранение приостановлено. Восстановите копию или начните заново."
                          : "Изменение не применено. Проверьте свободное место и доступ к хранилищу."),
                    )}
                  </p>
                </div>
                <Button onClick={exportBackup}>
                  <Download size={16} />
                  {tr("Скачать копию")}
                </Button>
                {storageStatus === "recovered" && (
                  <Button onClick={() => setConfirmation("recovery")}>
                    {tr("Восстановить последнюю копию")}
                  </Button>
                )}
                {(storageStatus === "corrupt" ||
                  storageStatus === "recovered") && (
                  <>
                    <Button onClick={() => navigate("profile")}>
                      {tr("Импортировать копию")}
                    </Button>
                    <Button onClick={() => setConfirmation("reset")}>
                      {tr("Начать заново")}
                    </Button>
                  </>
                )}
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
                          ? tr(
                              "Запланируйте продукты, а после покупки укажите цену — всё сохранится автоматически.",
                            )
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
              <FeatureBoundary language={language} key={page}>
                <Suspense fallback={<LoadingState />}>
                  {page === "overview" && (
                    <OverviewPage
                      data={data}
                      summary={summary}
                      month={month}
                      currency={currency}
                      language={language}
                      streakCurrent={streak.current}
                      chartRange={chartRange}
                      onChartRangeChange={setChartRange}
                      celebration={
                        bountyCelebration?.page === "overview"
                          ? bountyCelebration
                          : null
                      }
                      showDemoBanner={showDemoBanner}
                      onDismissDemo={() => setShowDemoBanner(false)}
                      onDemo={startDemo}
                      onAddExpense={() => setModal("new")}
                      onProfile={() => navigate("profile")}
                      onTracker={() => navigate("tracker")}
                      onShowAll={() => {
                        setAllTime(false);
                        setSearch("");
                        setCategory("all");
                        setFilterCurrency("all");
                        navigate("tracker");
                      }}
                      onOpen={setDetailId}
                      onEdit={setModal}
                      onDelete={deleteTransaction}
                      emptyState={emptyState()}
                    />
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
                      onConfirm={confirmPlannedPurchase}
                    />
                  )}
                  {page === "tracker" && (
                    <TrackerPage
                      filtered={filtered}
                      language={language}
                      currency={currency}
                      search={search}
                      category={category}
                      filterCurrency={filterCurrency}
                      sort={sort}
                      allTime={allTime}
                      searchPending={search !== deferredSearch}
                      paginationKey={JSON.stringify([
                        deferredSearch,
                        category,
                        filterCurrency,
                        sort,
                        month,
                        allTime,
                      ])}
                      storageOk={storageOk}
                      pdfBusy={pdfBusy}
                      emptyState={emptyState(data.transactions.length > 0)}
                      onSearch={setSearch}
                      onCategory={setCategory}
                      onCurrencyFilter={setFilterCurrency}
                      onSort={setSort}
                      onAllTime={setAllTime}
                      onOpen={setDetailId}
                      onEdit={setModal}
                      onDelete={deleteTransaction}
                      onExport={exportReport}
                      onProfile={() => navigate("profile")}
                    />
                  )}
                  {page === "profile" && (
                    <ProfilePage
                      data={data}
                      profile={profile}
                      setProfile={setProfile}
                      initials={initials}
                      language={language}
                      storageOk={storageOk}
                      storageError={storageError}
                      celebration={
                        bountyCelebration?.page === "profile"
                          ? bountyCelebration
                          : null
                      }
                      onFlush={flushProfile}
                      onReload={reloadProfile}
                      onSave={() => {
                        if (flushProfile())
                          setToast({ message: "Настройки профиля сохранены" });
                      }}
                      onAvatarSelect={selectAvatar}
                      onEditAvatar={() =>
                        setAvatarSource({ src: data.profile.avatar })
                      }
                      onRemoveAvatar={() => {
                        commitProfileFields({ avatar: undefined });
                      }}
                      onCurrencyChange={updateCurrency}
                      onThemeChange={(theme) => {
                        commitProfileFields({ theme });
                      }}
                      onLanguageChange={(next) => {
                        commitProfileFields({ language: next });
                      }}
                      onExport={exportBackup}
                      onImport={(file) => {
                        void importBackup(file);
                      }}
                      onDemo={startDemo}
                      onReset={() => setConfirmation("reset")}
                      onAddExpense={() => setModal("new")}
                    />
                  )}
                </Suspense>
              </FeatureBoundary>
            </div>
          </main>
        </div>
        {avatarSource && (
          <Modal
            className="avatar-crop-modal"
            label={tr("Редактор аватара")}
            onClose={() => setAvatarSource(null)}
          >
            <FeatureBoundary language={language}>
              <Suspense fallback={<LoadingState />}>
                <AvatarCropper
                  {...avatarSource}
                  language={language}
                  onSave={saveAvatar}
                  onClose={() => setAvatarSource(null)}
                />
              </Suspense>
            </FeatureBoundary>
          </Modal>
        )}
        {detailRecord && !modal && (
          <Modal className="detail-modal" onClose={() => setDetailId(null)}>
            <FeatureBoundary language={language}>
              <Suspense fallback={<LoadingState />}>
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
                    return Boolean(
                      setData((d) => {
                        const record = mergeTransactionDraft(
                          detailRecord,
                          d.transactions.find((t) => t.id === value.id),
                          value,
                        );
                        return {
                          ...d,
                          transactions: d.transactions.map((t) =>
                            t.id === value.id ? record : t,
                          ),
                        };
                      }),
                    );
                  }}
                />
              </Suspense>
            </FeatureBoundary>
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
              {Boolean(pendingImport.shoppingList?.length) && (
                <span>
                  {" "}
                  · {tr("Список покупок")}: {pendingImport.shoppingList!.length}
                </span>
              )}
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
          <Modal onClose={() => setModal(null)}>
            <FeatureBoundary language={language}>
              <Suspense fallback={<LoadingState />}>
                <TransactionDialog
                  key={modal === "new" ? "new" : JSON.stringify(modal)}
                  value={modal === "new" ? null : modal}
                  defaultCurrency={currency}
                  onClose={() => setModal(null)}
                  onSave={saveTransaction}
                  onReload={
                    modal === "new"
                      ? undefined
                      : () => {
                          const current = data.transactions.find(
                            (t) => t.id === modal.id,
                          );
                          setModal(current ?? null);
                        }
                  }
                />
              </Suspense>
            </FeatureBoundary>
          </Modal>
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
                  {confirmation === "recovery"
                    ? tr("Восстановить последнюю копию?")
                    : confirmation === "reset"
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
              {confirmation === "recovery"
                ? tr(
                    "Повреждённые данные будут сохранены отдельно. Рабочая копия снова станет доступна для изменений.",
                  )
                : confirmation === "reset"
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
                {confirmation === "recovery"
                  ? tr("Восстановить копию")
                  : confirmation === "reset"
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
            {toast.error ? (
              <CircleHelp size={19} />
            ) : toast.pirate ? (
              <Sparkles size={19} />
            ) : (
              <CheckCheck size={19} />
            )}
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
