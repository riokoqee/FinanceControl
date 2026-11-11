import { describe, expect, it } from "vitest";
import { createEmptyData, validateBackup } from "../finance";
import type { AppData, Transaction } from "../finance";
import { APP_DATA_VERSIONS, withCanonicalVersion } from "../appDataVersion";
import { withTrackingDays } from "./withTrackingDays";

const now = new Date(2026, 10, 9, 12);
const expense = (patch: Partial<Transaction> = {}): Transaction => ({
  id: "bread",
  title: "Bread",
  amount: 2,
  currency: "EUR",
  category: "food",
  date: "2026-11-09",
  createdAt: "2026-11-09",
  ...patch,
});

describe("canonical feature formats and atomic tracking days", () => {
  it("leaves an unused installation and explicit version-two legacy shape untouched", () => {
    const empty = createEmptyData();
    expect(withTrackingDays(empty, empty, now)).toBe(empty);
    expect(withCanonicalVersion(empty)).toBe(empty);
    const legacy: AppData = { ...empty, version: APP_DATA_VERSIONS.planning };
    expect(withTrackingDays(legacy, legacy, now)).toBe(legacy);
    expect(validateBackup(legacy)).toEqual(legacy);
    expect(legacy).not.toHaveProperty("streak");
  });

  it("selects planning format when a legacy snapshot first saves empty feature records", () => {
    const empty = createEmptyData();
    const next = withTrackingDays(
      empty,
      { ...empty, categoryBudgets: [] },
      now,
    );
    expect(next.version).toBe(APP_DATA_VERSIONS.planning);
    expect(next).not.toHaveProperty("streak");
    expect(next.transactions).toBe(empty.transactions);
  });

  it("records the creation day atomically and preserves it when the expense is deleted", () => {
    const empty = createEmptyData();
    const desired = {
      ...empty,
      transactions: [expense({ date: "2026-10-01" })],
    };
    const saved = withTrackingDays(empty, desired, now);
    expect(saved.version).toBe(APP_DATA_VERSIONS.streak);
    expect(saved.streak?.confirmedDays).toEqual([
      { date: "2026-11-09", status: "LOGGED" },
    ]);
    const removed = withTrackingDays(
      saved,
      { ...saved, transactions: [] },
      now,
    );
    expect(removed.streak).toBe(saved.streak);
    expect(removed.transactions).toEqual([]);
    expect(desired).not.toHaveProperty("streak");
  });

  it("retains legacy activity if the first mutation deletes the last historical expense", () => {
    const previous = {
      ...createEmptyData(),
      transactions: [expense({ date: "2026-11-08", createdAt: "2026-11-08" })],
    };
    const next = withTrackingDays(
      previous,
      { ...previous, transactions: [] },
      now,
    );
    expect(next.streak?.confirmedDays).toEqual([
      { date: "2026-11-08", status: "LOGGED" },
    ]);
    expect(next.streak?.startedOn).toBe("2026-11-09");
  });

  it("unions check-ins with original history, upgrades LOGGED once, and replays idempotently", () => {
    const previous: AppData = {
      ...createEmptyData(),
      version: APP_DATA_VERSIONS.streak,
      streak: {
        version: 1,
        startedOn: "2026-11-01",
        confirmedDays: [{ date: "2026-11-08", status: "NO_SPEND" }],
      },
    };
    const desired: AppData = {
      ...previous,
      transactions: [expense()],
      streak: {
        version: 1,
        startedOn: "2026-11-09",
        confirmedDays: [{ date: "2026-11-09", status: "NO_SPEND" }],
      },
    };
    const next = withTrackingDays(previous, desired, now);
    expect(next.streak?.startedOn).toBe("2026-11-01");
    expect(next.streak?.confirmedDays).toEqual([
      { date: "2026-11-08", status: "NO_SPEND" },
      { date: "2026-11-09", status: "LOGGED" },
    ]);
    expect(withTrackingDays(next, next, now)).toBe(next);
  });

  it("keeps automatic-rate policy and format when tracking facts are created or retained", () => {
    const empty = createEmptyData();
    const automatic: AppData = {
      ...empty,
      profile: { ...empty.profile, exchangeRateSync: { mode: "automatic" } },
    };
    const selected = withTrackingDays(empty, automatic, now);
    expect(selected.version).toBe(APP_DATA_VERSIONS.automaticRates);
    expect(selected).not.toHaveProperty("streak");
    const logged = withTrackingDays(
      selected,
      { ...selected, transactions: [expense()] },
      now,
    );
    const deleted = withTrackingDays(
      logged,
      { ...logged, transactions: [] },
      now,
    );
    expect(deleted.version).toBe(APP_DATA_VERSIONS.automaticRates);
    expect(deleted.profile.exchangeRateSync).toEqual({ mode: "automatic" });
    expect(deleted.streak?.confirmedDays).toEqual([
      { date: "2026-11-09", status: "LOGGED" },
    ]);
    expect(validateBackup(deleted)).toEqual(deleted);
  });

  it("preserves the manual-rate format with and without daily tracking facts", () => {
    const empty = createEmptyData();
    const manual: AppData = {
      ...empty,
      profile: {
        ...empty.profile,
        exchangeRates: { USD: 1, EUR: 0.95, KZT: 510 },
      },
    };
    const first = withTrackingDays(empty, manual, now);
    expect(first.version).toBe(APP_DATA_VERSIONS.manualRates);
    expect(first).not.toHaveProperty("streak");
    const logged = withTrackingDays(
      first,
      { ...first, transactions: [expense()] },
      now,
    );
    expect(logged.version).toBe(APP_DATA_VERSIONS.manualRates);
    expect(logged.profile.exchangeRates).toBe(manual.profile.exchangeRates);
    expect(logged.streak?.confirmedDays).toHaveLength(1);
    expect(validateBackup(logged)).toEqual(logged);
  });
});
