import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Flame, Plus, Trophy } from "lucide-react";
import type { Language, Profile, Transaction } from "../lib/finance";
import { todayString } from "../lib/finance";
import { BERRIES_PER_DAY, getStreakStats } from "../lib/streak";
import "./StreakBounty.css";

interface StreakBountyProps {
  transactions: Transaction[];
  profile: Profile;
  language: Language;
  variant?: "overview" | "profile";
  onAddExpense?: () => void;
}

const copy = {
  ru: {
    overview: "НАВСТРЕЧУ НОВОЙ ЛЕГЕНДЕ",
    profile: "ДОСЬЕ КАПИТАНА",
    emptyTitle: "Ваша легенда начинается здесь",
    emptyDescription:
      "Добавляйте хотя бы одну запись в день: серия будет расти, а вместе с ней — награда за вашу голову.",
    description:
      "Каждая запись приближает к порядку в финансах. Каждый новый день в серии повышает вашу награду.",
    recorded: "Сегодня запись уже в журнале",
    waiting: "Добавьте запись сегодня, чтобы сохранить серию",
    begin: "Начать серию",
    continue: "Продолжить серию",
    add: "Добавить запись",
    best: "Лучшая серия",
    daily: "За день серии",
    berries: "берри",
    nextToday: "После записи сегодня",
    nextTomorrow: "После записи завтра",
    reward: "Награда за голову",
    portrait: "Аватар капитана",
    fictional: "Игровая награда за вашу привычку",
    emptyStatus: "0 дней подряд",
    noPoster: "Первый день — первый постер WANTED",
  },
  en: {
    overview: "YOUR NEXT GREAT ADVENTURE",
    profile: "CAPTAIN’S DOSSIER",
    emptyTitle: "Your legend starts here",
    emptyDescription:
      "Add at least one record each day to grow your streak and the bounty on your head.",
    description:
      "Each record brings your finances into focus. Each new day in your streak raises your bounty.",
    recorded: "Today’s record is in the log",
    waiting: "Add a record today to keep your streak",
    begin: "Start your streak",
    continue: "Keep your streak",
    add: "Add a record",
    best: "Best streak",
    daily: "Per streak day",
    berries: "berries",
    nextToday: "After today’s record",
    nextTomorrow: "After tomorrow’s record",
    reward: "Bounty on your head",
    portrait: "Captain’s avatar",
    fictional: "An in-world reward for your habit",
    emptyStatus: "0 days in a row",
    noPoster: "First day, first WANTED poster",
  },
};

function dayLabel(count: number, language: Language): string {
  if (language === "en") return `${count} ${count === 1 ? "day" : "days"}`;
  const plural = new Intl.PluralRules("ru").select(count);
  return `${count} ${plural === "one" ? "день" : plural === "few" ? "дня" : "дней"}`;
}

/** Refresh at midnight or after returning to a tab that was asleep overnight. */
function useLocalCalendarDay(): string {
  const [day, setDay] = useState(() => todayString());
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setDay(todayString());
      clearTimeout(timeout);
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 0, 50);
      timeout = setTimeout(
        refresh,
        Math.max(1, nextMidnight.getTime() - Date.now()),
      );
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}

export function useStreakStats(transactions: readonly Transaction[]) {
  const day = useLocalCalendarDay();
  return useMemo(
    () => getStreakStats(transactions, new Date(`${day}T12:00:00`)),
    [transactions, day],
  );
}

export function StreakBadge({
  transactions,
  language,
  onClick,
}: {
  transactions: Transaction[];
  language: Language;
  onClick?: () => void;
}) {
  const stats = useStreakStats(transactions);
  const label =
    language === "en"
      ? `Recording streak: ${dayLabel(stats.current, language)}. ${stats.activeToday ? "Recorded today." : "Add a record today."}`
      : `Серия записей: ${dayLabel(stats.current, language)}. ${stats.activeToday ? "Сегодня запись уже добавлена." : "Добавьте запись сегодня."}`;
  return (
    <button
      type="button"
      className={`streak-nav-badge ${stats.current > 0 ? "streak-nav-badge--active" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      data-streak={stats.current}
    >
      <Flame size={15} aria-hidden="true" />
      <span>{dayLabel(stats.current, language)}</span>
      {stats.activeToday && (
        <span className="streak-nav-badge-dot" aria-hidden="true" />
      )}
    </button>
  );
}

export default function StreakBounty({
  transactions,
  profile,
  language,
  variant = "overview",
  onAddExpense,
}: StreakBountyProps) {
  const stats = useStreakStats(transactions);
  const t = copy[language];
  const hasStreak = stats.current > 0;
  const formatBerries = (amount: number) =>
    new Intl.NumberFormat(language === "en" ? "en-US" : "ru-RU").format(amount);
  const currentLabel =
    language === "en"
      ? `${dayLabel(stats.current, language)} in a row`
      : `${dayLabel(stats.current, language)} подряд`;

  return (
    <section
      className={`streak-bounty streak-bounty--${variant} ${hasStreak ? "streak-bounty--active" : "streak-bounty--empty"}`}
      aria-label={
        language === "en" ? "Daily streak and bounty" : "Серия дней и награда"
      }
      data-streak={stats.current}
      data-active-today={stats.activeToday}
    >
      <div className="streak-bounty-copy">
        <div className="streak-bounty-eyebrow">
          <Flame size={14} aria-hidden="true" />
          {t[variant]}
        </div>
        <h2 className="streak-bounty-title">
          {hasStreak ? currentLabel : t.emptyTitle}
          {hasStreak && (
            <span className="streak-bounty-title-spark" aria-hidden="true">
              ✦
            </span>
          )}
        </h2>
        <p className="streak-bounty-description">
          {hasStreak ? t.description : t.emptyDescription}
        </p>
        {hasStreak ? (
          <div
            className={`streak-bounty-status ${stats.activeToday ? "streak-bounty-status--done" : ""}`}
          >
            {stats.activeToday ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <Flame size={15} aria-hidden="true" />
            )}
            <span>{stats.activeToday ? t.recorded : t.waiting}</span>
          </div>
        ) : (
          <div className="streak-bounty-first-day">
            <span>
              <Flame size={14} aria-hidden="true" />
              {t.emptyStatus}
            </span>
            {t.noPoster}
          </div>
        )}
        <div className="streak-bounty-metrics">
          <div>
            <span>
              <Trophy size={13} aria-hidden="true" />
              {t.best}
            </span>
            <strong>{dayLabel(stats.longest, language)}</strong>
          </div>
          <div>
            <span>{t.daily}</span>
            <strong>
              +{formatBerries(BERRIES_PER_DAY)} <small>{t.berries}</small>
            </strong>
          </div>
        </div>
        <div className="streak-bounty-action-row">
          {onAddExpense && (
            <button
              type="button"
              className="button button-primary streak-bounty-cta"
              onClick={onAddExpense}
            >
              <Plus size={15} aria-hidden="true" />
              {hasStreak ? (stats.activeToday ? t.add : t.continue) : t.begin}
            </button>
          )}
          {hasStreak && (
            <div className="streak-bounty-next">
              <span>{stats.activeToday ? t.nextTomorrow : t.nextToday}</span>
              <strong>
                <ArrowUpRight size={13} aria-hidden="true" />
                {formatBerries(stats.nextBounty)} {t.berries}
              </strong>
            </div>
          )}
        </div>
      </div>

      {hasStreak && (
        <figure
          className="bounty-poster"
          aria-label={`${t.reward}: ${formatBerries(stats.bounty)} ${t.berries}`}
          data-bounty={stats.bounty}
        >
          <div className="bounty-poster-frame">
            <span className="bounty-poster-wanted">WANTED</span>
            <div
              className={`bounty-poster-portrait ${profile.avatar ? "" : "bounty-poster-portrait--hat"}`}
            >
              <img
                src={profile.avatar || `${import.meta.env.BASE_URL}belilog-icon-512.png`}
                alt={t.portrait}
              />
              <span className="bounty-poster-stamp" aria-hidden="true">
                B • L
              </span>
            </div>
            <span className="bounty-poster-alive">DEAD OR ALIVE</span>
            <span className="bounty-poster-name">{profile.name}</span>
            <div className="bounty-poster-amount" key={stats.bounty}>
              <span className="bounty-berry" aria-hidden="true">
                B
              </span>
              <strong>{formatBerries(stats.bounty)}</strong>
            </div>
            <figcaption className="bounty-poster-footer">
              <span>MARINE</span>
              <span>BELILOG • GRAND LINE</span>
            </figcaption>
          </div>
          <span className="bounty-poster-note">{t.fictional}</span>
        </figure>
      )}
    </section>
  );
}
