import { memo, useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Crown, Flame, Leaf, Plus, Skull, Snowflake, Star, Trophy } from "lucide-react";
import type { Language, Profile, Transaction } from "../lib/finance";
import { BERRIES_PER_DAY } from "../lib/streak/streak";
import { useStreakStats } from "../hooks/useStreakStats";
import { useLocalCalendarDay } from "../hooks/useStreakStats";
import type { StreakLedger } from "../lib/streak/streakTypes";
import { streakCopy, streakMessage } from "../lib/streak/streakCopy";
import StreakDays from "./StreakDays";
import { dayLabel } from "./StreakBadge";
export { useStreakStats } from "../hooks/useStreakStats";
export { default as StreakBadge } from "./StreakBadge";
import { getPirateProgress } from "../lib/streak/pirateRanks";
import type { StreakIncrease } from "../lib/streak/pirateRanks";
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
  ledger?: StreakLedger;
  variant?: "overview" | "profile";
  onAddExpense?: () => void;
  onNoSpend?: (day: string) => void;
  onConfirmDay?: (day: string) => void;
  busy?: boolean;
  celebration?: BountyCelebration | null;
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

const berryFormatters = {
  ru: new Intl.NumberFormat("ru-RU"),
  en: new Intl.NumberFormat("en-US"),
};

/** Only this number rerenders during the reward animation. */
function AnimatedBountyAmount({ bounty, celebration, language }: {
  bounty: number;
  celebration: BountyCelebration | null;
  language: Language;
}) {
  const amount = useBountyAmount(bounty, celebration);
  return <strong aria-hidden="true">{berryFormatters[language].format(amount)}</strong>;
}

export default memo(function StreakBounty({
  transactions,
  profile,
  language,
  ledger,
  variant = "overview",
  onAddExpense,
  onNoSpend,
  onConfirmDay,
  busy = false,
  celebration = null,
}: StreakBountyProps) {
  const stats = useStreakStats(transactions, ledger);
  const today = useLocalCalendarDay();
  const progression = getPirateProgress(stats.current);
  const activeCelebration = celebration?.toDays === stats.current && stats.activeToday ? celebration : null;
  const t = streakCopy[language];
  const hasStreak = stats.current > 0;
  const hasTodayPurchases = transactions.some((transaction) => transaction.date === today);
  const formatBerries = (amount: number) =>
    berryFormatters[language].format(amount);
  const currentLabel = streakMessage(t.inRow, { days: dayLabel(stats.current, language) });
  const progressLabel = progression.nextRank
    ? streakMessage(t.rankRemaining, { days: dayLabel(progression.daysRemaining, language), rank: progression.nextRank.name[language] })
    : t.legend;
  const RankSeal = progression.rank?.id === "legend" ? Crown : progression.rank?.id === "supernova" ? Star : Skull;

  return (
    <section
      className={`streak-bounty streak-bounty--${variant} ${hasStreak ? "streak-bounty--active" : "streak-bounty--empty"}`}
      aria-label={t.region}
      data-streak={stats.current}
      data-active-today={stats.activeToday}
      data-today-status={stats.todayStatus}
      data-freezes={stats.freezes}
      data-rank={progression.rank?.id ?? "none"}
    >
      <div className="streak-bounty-copy">
        <h2 className="streak-bounty-title">
          {hasStreak ? currentLabel : t.emptyTitle}
          {hasStreak && (
            <span className="streak-bounty-title-spark" aria-hidden="true">
              ✦
            </span>
          )}
        </h2>
        {!hasStreak && (
          <p className="streak-bounty-description">{t.emptyDescription}</p>
        )}
        {hasStreak ? (
          <div
            className={`streak-bounty-status ${stats.activeToday ? "streak-bounty-status--done" : ""}`}
          >
            {stats.activeToday ? (
              stats.todayStatus === "NO_SPEND" ? <Leaf size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <Flame size={15} aria-hidden="true" />
            )}
            <span>{stats.todayStatus === "NO_SPEND" ? t.noSpendRecorded : stats.activeToday ? t.recorded : t.waiting}</span>
          </div>
        ) : (
          <div className="streak-bounty-first-day">
            <span>
              <Flame size={14} aria-hidden="true" />
              {t.noPoster}
            </span>
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
          <div className="streak-freezes" title={t.freezeRule}>
            <span><Snowflake size={13} aria-hidden="true" />{t.freezes}</span>
            <strong>{stats.freezes}<small> / 2</small></strong>
          </div>
        </div>
        <div className="streak-freeze-hint">
          <p>{t.freezeHint}</p>
          <span role="img" aria-label={stats.freezes === 2 ? streakMessage(t.freezeCount, { count: stats.freezes }) : streakMessage(t.freezeProgress, { count: stats.freezeProgress })}>{stats.freezeProgress}/7</span>
        </div>
        {progression.rank && (
          <div className="pirate-progress" role="group" aria-label={t.progression}>
            <div className="pirate-progress-heading">
              <strong>{progression.rank.name[language]}</strong>
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
          {onNoSpend && !stats.activeToday && (
            <button
              type="button"
              className="button button-secondary streak-no-spend"
              onClick={() => onNoSpend(today)}
              disabled={busy}
            >
              {hasTodayPurchases ? <CheckCircle2 size={15} aria-hidden="true" /> : <Leaf size={15} aria-hidden="true" />}
              {hasTodayPurchases ? t.confirmTracking : t.noSpend}
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
        <StreakDays transactions={transactions} ledger={ledger} language={language} busy={busy} onConfirmDay={onConfirmDay} />
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
              <AnimatedBountyAmount bounty={stats.bounty} celebration={activeCelebration} language={language} />
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
        </figure>
      )}
    </section>
  );
});
