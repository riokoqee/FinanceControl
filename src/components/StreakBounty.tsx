import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Crown, Flame, Plus, Skull, Star, Trophy } from "lucide-react";
import type { Language, Profile, Transaction } from "../lib/finance";
import { todayString } from "../lib/finance";
import { BERRIES_PER_DAY, getStreakStats } from "../lib/streak";
import { getPirateProgress } from "../lib/pirateRanks";
import type { StreakIncrease } from "../lib/pirateRanks";
import "./StreakBounty.css";

/** Transient UI feedback, created only by saving a new daily record. */
export interface BountyCelebration extends StreakIncrease {
  id: string;
  expiresAt: number;
}

interface StreakBountyProps {
  transactions: Transaction[];
  profile: Profile;
  language: Language;
  variant?: "overview" | "profile";
  onAddExpense?: () => void;
  celebration?: BountyCelebration | null;
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
    progression: "Прогресс пиратского ранга",
    promoted: "НОВЫЙ ПИРАТСКИЙ РАНГ",
    legend: "Легенда морей достигнута",
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
    progression: "Pirate rank progress",
    promoted: "PIRATE RANK UNLOCKED",
    legend: "Legend of the Seas achieved",
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

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useBountyAmount(bounty: number, celebration: BountyCelebration | null) {
  const reduced = useReducedMotion();
  const [animation, setAnimation] = useState<{ id: string; amount: number } | null>(null);
  useEffect(() => {
    if (!celebration || reduced) return;
    let frame = 0;
    const started = performance.now();
    const update = (now: number) => {
      const progress = Math.min(1, (now - started) / 1200);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimation({
        id: celebration.id,
        amount: Math.round(celebration.fromBounty + (celebration.toBounty - celebration.fromBounty) * eased),
      });
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [celebration, reduced]);
  if (!celebration || reduced) return bounty;
  return animation?.id === celebration.id ? animation.amount : celebration.fromBounty;
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
  celebration = null,
}: StreakBountyProps) {
  const stats = useStreakStats(transactions);
  const progression = getPirateProgress(stats.current);
  const activeCelebration = celebration?.toDays === stats.current && stats.activeToday ? celebration : null;
  const displayedBounty = useBountyAmount(stats.bounty, activeCelebration);
  const t = copy[language];
  const hasStreak = stats.current > 0;
  const formatBerries = (amount: number) =>
    new Intl.NumberFormat(language === "en" ? "en-US" : "ru-RU").format(amount);
  const currentLabel =
    language === "en"
      ? `${dayLabel(stats.current, language)} in a row`
      : `${dayLabel(stats.current, language)} подряд`;
  const progressLabel = progression.nextRank
    ? language === "en"
      ? `${dayLabel(progression.daysRemaining, language)} until ${progression.nextRank.name[language]}`
      : `Ещё ${dayLabel(progression.daysRemaining, language)} до ранга «${progression.nextRank.name[language]}»`
    : t.legend;
  const RankSeal = progression.rank?.id === "legend" ? Crown : progression.rank?.id === "supernova" ? Star : Skull;

  return (
    <section
      className={`streak-bounty streak-bounty--${variant} ${hasStreak ? "streak-bounty--active" : "streak-bounty--empty"}`}
      aria-label={
        language === "en" ? "Daily streak and bounty" : "Серия дней и награда"
      }
      data-streak={stats.current}
      data-active-today={stats.activeToday}
      data-rank={progression.rank?.id ?? "none"}
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
        {progression.rank && (
          <div className="pirate-progress" aria-label={t.progression}>
            <div className="pirate-progress-heading">
              <strong>{progression.rank.name[language]}</strong>
              <span>{dayLabel(stats.current, language)}</span>
            </div>
            <div
              className="pirate-progress-track"
              role="progressbar"
              aria-label={t.progression}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progression.progress * 100)}
              aria-valuetext={`${progression.rank.name[language]}. ${progressLabel}`}
            >
              <span style={{ transform: `scaleX(${progression.progress})` }} />
            </div>
            <p className="pirate-progress-caption">{progressLabel}</p>
          </div>
        )}
        {activeCelebration?.promoted && (
          <div className="pirate-promotion" key={activeCelebration.id}>
            <Trophy size={20} aria-hidden="true" />
            <span><small>{t.promoted}</small><strong>{activeCelebration.rank.name[language]}</strong></span>
          </div>
        )}
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
          className={`bounty-poster ${activeCelebration ? "bounty-poster--increased" : ""}`}
          aria-label={`${t.reward}: ${formatBerries(stats.bounty)} ${t.berries}`}
          data-bounty={stats.bounty}
          data-rank={progression.rank?.id}
        >
          <div className="bounty-poster-paper">
          <span className="bounty-poster-weathering" aria-hidden="true" />
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
                {progression.rank?.id === "rookie" ? "B • L" : <RankSeal size={16} strokeWidth={1.4} />}
              </span>
            </div>
            <span className="bounty-poster-alive">DEAD OR ALIVE</span>
            <span className="bounty-poster-name">{profile.name}</span>
            <div className="bounty-poster-amount">
              <span className="bounty-berry" aria-hidden="true">
                B
              </span>
              <strong aria-hidden="true">{formatBerries(displayedBounty)}</strong>
            </div>
            <div className="bounty-poster-footer">
              <span>MARINE</span>
              <span>BELILOG • GRAND LINE</span>
            </div>
          </div>
          </div>
          <div className="bounty-poster-effects" aria-hidden="true">
            <span className="bounty-flame"><i /><i /><i /></span>
            {Array.from({ length: 6 }, (_, index) => <i className="bounty-ember" key={`ember-${index}`} />)}
            {Array.from({ length: 3 }, (_, index) => <i className="bounty-ash" key={`ash-${index}`} />)}
          </div>
          {activeCelebration && (
            <div className="bounty-burst" key={activeCelebration.id} aria-hidden="true">
              <span className="bounty-increased-stamp">BOUNTY INCREASED</span>
              {Array.from({ length: 6 }, (_, index) => <i className="bounty-gold-spark" key={index} />)}
            </div>
          )}
          <span className="bounty-poster-note">{t.fictional}</span>
        </figure>
      )}
    </section>
  );
}
