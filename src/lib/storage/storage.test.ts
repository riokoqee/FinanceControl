import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  MAX_BACKUP_LENGTH,
  MAX_TRANSACTIONS,
  STORAGE_KEY,
  createEmptyData,
  type AppData,
  type CategoryBudget,
  type ShoppingTemplate,
  type Transaction,
} from "../finance";
import {
  CORRUPT_KEY,
  LAST_GOOD_KEY,
  DataConflictError,
  StorageRecoveryError,
  commitStoredData,
  commitStoredMutation,
  commitStoredOperation,
  mergeAppData,
  mergeCategoryBudgetsDraft,
  mergeProfileDraft,
  mergeTransactionDraft,
  parseMoney,
  readStoredData,
  writeStoredData,
} from "./storage";
import {
  applyShoppingTemplate,
  makeShoppingTemplate,
} from "../shopping/templates";
import type { StreakLedger } from "../streak/streakTypes";
import { CURRENT_APP_DATA_VERSION } from "../appDataVersion";

const expense = (patch: Partial<Transaction> = {}): Transaction => ({
  id: "expense",
  title: "Groceries",
  amount: 25,
  currency: "EUR",
  category: "food",
  date: "2026-11-03",
  ...patch,
});
const data = (): AppData => ({
  ...createEmptyData(),
  transactions: [expense()],
});
const copy = <T>(value: T): T => structuredClone(value);
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  return {
    values,
    writes,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push([key, value]);
      values.set(key, value);
    },
  };
}

describe("committed operation metadata", () => {
  it("returns metadata from the latest primary and persists data without metadata", () => {
    const base = data();
    const remote = { ...base, transactions: [expense({ amount: 40 })] };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const saved = commitStoredOperation(
      base,
      (current) => ({
        data: { ...current, profile: { ...current.profile, name: "Captain" } },
        result: {
          previousAmount: current.transactions[0].amount,
          message: "saved",
        },
      }),
      storage,
    );
    expect(saved.result).toEqual({ previousAmount: 40, message: "saved" });
    expect(saved.data.profile.name).toBe("Captain");
    expect(saved.data.transactions[0].amount).toBe(40);
    expect(JSON.parse(storage.values.get(STORAGE_KEY)!)).toEqual(saved.data);
    expect(JSON.parse(storage.values.get(STORAGE_KEY)!)).not.toHaveProperty(
      "result",
    );
  });

  it("discards a reward from a failed attempt when another tab confirms before its write", () => {
    const base = createEmptyData();
    const confirmed: AppData = {
      ...base,
      version: 3,
      streak: {
        version: 1,
        startedOn: "2026-11-09",
        confirmedDays: [{ date: "2026-11-09", status: "LOGGED" }],
      },
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, JSON.stringify(confirmed));
        return storage.getItem(key);
      },
    };
    const saved = commitStoredOperation(
      base,
      (current) =>
        current.streak?.confirmedDays.length
          ? { data: current, result: { awarded: false, amount: 0 } }
          : {
              data: {
                ...current,
                streak: {
                  version: 1,
                  startedOn: "2026-11-09",
                  confirmedDays: [{ date: "2026-11-09", status: "NO_SPEND" }],
                },
              },
              result: { awarded: true, amount: 500_000 },
            },
      racing,
    );
    expect(reads).toBe(4);
    expect(saved.result).toEqual({ awarded: false, amount: 0 });
    expect(saved.data.streak).toEqual(confirmed.streak);
    expect(storage.writes.filter(([key]) => key === STORAGE_KEY)).toHaveLength(
      1,
    );
  });

  it("keeps structural sharing and record order when metadata accompanies a profile change", () => {
    const base = data();
    base.transactions.push(expense({ id: "second", amount: 30 }));
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const saved = commitStoredOperation(
      base,
      (current) => ({
        data: {
          ...current,
          profile: { ...current.profile, language: "en" },
          transactions: [...current.transactions].reverse(),
        },
        result: "profile",
      }),
      storage,
    );
    expect(saved.result).toBe("profile");
    expect(saved.data.transactions).toBe(base.transactions);
    expect(saved.data.transactions.map((entry) => entry.id)).toEqual([
      "expense",
      "second",
    ]);
  });

  it("throws instead of returning generated metadata when the primary write fails", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const full = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() =>
      commitStoredOperation(
        base,
        (current) => ({
          data: {
            ...current,
            profile: { ...current.profile, name: "Captain" },
          },
          result: { awarded: true },
        }),
        full,
      ),
    ).toThrow("QuotaExceededError");
    expect(readStoredData(storage).data).toEqual(base);
    expect(storage.writes).toEqual([]);
  });

  it("still returns the committed result when only the secondary copy is full", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const fullSecondary = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === LAST_GOOD_KEY) throw new Error("QuotaExceededError");
        storage.setItem(key, value);
      },
    };
    const saved = commitStoredOperation(
      base,
      (current) => ({
        data: { ...current, profile: { ...current.profile, name: "Captain" } },
        result: 7,
      }),
      fullSecondary,
    );
    expect(saved.result).toBe(7);
    expect(readStoredData(storage).data).toEqual(saved.data);
  });

  it("retains recovery and validation guards before returning any result", () => {
    const base = data();
    const damaged = memoryStorage({
      [STORAGE_KEY]: "{damaged",
      [LAST_GOOD_KEY]: JSON.stringify(base),
    });
    expect(() =>
      commitStoredOperation(
        base,
        () => {
          throw new Error("Operation must not run");
        },
        damaged,
      ),
    ).toThrow(StorageRecoveryError);
    expect(damaged.writes).toEqual([]);
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    expect(() =>
      commitStoredOperation(
        base,
        (current) => ({
          data: { ...current, transactions: [expense({ amount: 0 })] },
          result: { awarded: true },
        }),
        storage,
      ),
    ).toThrow();
    expect(storage.writes).toEqual([]);
  });

  it("archives corrupt data before an explicit operation replacement and returns its committed result", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{damaged" });
    const saved = commitStoredOperation(
      createEmptyData(),
      () => ({ data: data(), result: "restored" }),
      storage,
      { replaceCorrupt: true },
    );
    expect(saved.result).toBe("restored");
    expect(storage.writes.map(([key]) => key)).toEqual([
      CORRUPT_KEY,
      STORAGE_KEY,
      LAST_GOOD_KEY,
    ]);
    expect(storage.values.get(CORRUPT_KEY)).toBe("{damaged");
    expect(readStoredData(storage).data).toEqual(saved.data);
  });

  it("stops repeated racing operations without returning metadata or discarding remote changes", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY)
          storage.values.set(
            key,
            JSON.stringify({
              ...base,
              profile: { ...base.profile, monthlyBudget: ++reads },
            }),
          );
        return storage.getItem(key);
      },
    };
    expect(() =>
      commitStoredOperation(
        base,
        (current) => ({
          data: {
            ...current,
            profile: { ...current.profile, name: "Captain" },
          },
          result: current.profile.monthlyBudget,
        }),
        racing,
      ),
    ).toThrow(DataConflictError);
    expect(reads).toBe(6);
    expect(storage.writes).toEqual([]);
  });
});

describe("persistent accounting-day confirmations", () => {
  const ledger = (
    ...confirmedDays: StreakLedger["confirmedDays"]
  ): StreakLedger => ({
    version: 1,
    startedOn: "2026-11-01",
    confirmedDays,
  });
  const withDays = (...days: StreakLedger["confirmedDays"]): AppData => ({
    ...data(),
    version: 3,
    streak: ledger(...days),
  });

  it("saves and reloads accounting days without adding an expense", () => {
    const base = createEmptyData();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const next = commitStoredData(
      base,
      { ...base, streak: ledger({ date: "2026-11-01", status: "NO_SPEND" }) },
      storage,
    );
    expect(next.version).toBe(3);
    expect(next.transactions).toEqual([]);
    expect(readStoredData(storage)).toEqual({ status: "ready", data: next });
    expect(JSON.parse(storage.values.get(LAST_GOOD_KEY)!)).toEqual(next);
  });

  it("unions independent days from two stale tabs instead of overwriting them", () => {
    const base = withDays();
    const remote = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const local = withDays({ date: "2026-11-02", status: "LOGGED" });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const next = commitStoredData(base, local, storage);
    expect(next.streak!.confirmedDays).toEqual([
      { date: "2026-11-01", status: "NO_SPEND" },
      { date: "2026-11-02", status: "LOGGED" },
    ]);
    expect(commitStoredData(base, local, storage).streak).toEqual(next.streak);
  });

  it("counts simultaneous confirmation once and gives a logged day priority", () => {
    const base = withDays();
    const noSpend = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const logged = withDays({ date: "2026-11-01", status: "LOGGED" });
    expect(mergeAppData(base, noSpend, logged).streak).toEqual(logged.streak);
    expect(mergeAppData(base, logged, noSpend).streak).toEqual(logged.streak);
    expect(
      mergeAppData(base, structuredClone(noSpend), noSpend).streak,
    ).toEqual(noSpend.streak);
  });

  it("retains daily facts when stale profile and expense edits have no ledger", () => {
    const base = data();
    const remote = {
      ...base,
      version: 3 as const,
      streak: ledger({ date: "2026-11-01", status: "NO_SPEND" }),
    };
    const desired = {
      ...base,
      profile: { ...base.profile, name: "Captain" },
      transactions: [expense({ amount: 30 })],
    };
    const next = mergeAppData(base, remote, desired);
    expect(next.profile.name).toBe("Captain");
    expect(next.transactions[0].amount).toBe(30);
    expect(next.streak).toEqual(remote.streak);
    expect(next.version).toBe(3);
  });

  it("does not delete a confirmation during ordinary fast-path or fresh mutations", () => {
    const base = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const desired = {
      ...data(),
      profile: { ...base.profile, name: "Captain" },
    };
    const fast = commitStoredData(base, desired, storage);
    expect(fast.streak).toEqual(base.streak);
    const fresh = commitStoredMutation(
      fast,
      () => ({ ...data(), profile: { ...base.profile, name: "Navigator" } }),
      storage,
    );
    expect(fresh.streak).toEqual(base.streak);
    expect(fresh.profile.name).toBe("Navigator");
  });

  it("allows an explicit full reset to remove accounting-day history", () => {
    const base = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    expect(
      commitStoredData(base, createEmptyData(), storage, {
        replaceCorrupt: true,
      }),
    ).toEqual(createEmptyData());
    expect(readStoredData(storage).data).not.toHaveProperty("streak");
  });

  it("does not resurrect accounting days when a stale editor saves after another tab resets everything", () => {
    const base = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const reset = createEmptyData();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(reset) });
    const desired = {
      ...base,
      profile: { ...base.profile, name: "Stale captain" },
    };
    expect(() => commitStoredData(base, desired, storage)).toThrow(
      DataConflictError,
    );
    expect(storage.values.get(STORAGE_KEY)).toBe(JSON.stringify(reset));
    expect(storage.writes).toEqual([]);
  });

  it("rejects stale edits after a full restore removes or downgrades previously confirmed facts", () => {
    const base = withDays({ date: "2026-11-01", status: "LOGGED" });
    const desired = {
      ...base,
      profile: { ...base.profile, name: "Stale captain" },
    };
    for (const remote of [
      withDays({ date: "2026-11-02", status: "NO_SPEND" }),
      withDays({ date: "2026-11-01", status: "NO_SPEND" }),
      { ...base, streak: { ...base.streak!, startedOn: "2026-11-02" } },
    ]) {
      expect(() => mergeAppData(base, remote, desired)).toThrow(
        DataConflictError,
      );
      // An unchanged local snapshot still accepts the replacement without a write.
      expect(mergeAppData(base, remote, base)).toEqual(remote);
      expect(mergeAppData(base, remote, structuredClone(base))).toEqual(remote);
    }
  });

  it("allows monotonic daily upgrades and earlier protection dates during concurrent edits", () => {
    const base = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const remote = withDays({ date: "2026-11-01", status: "LOGGED" });
    remote.streak!.startedOn = "2026-10-01";
    const desired = { ...base, profile: { ...base.profile, name: "Captain" } };
    const merged = mergeAppData(base, remote, desired);
    expect(merged.streak).toEqual(remote.streak);
    expect(merged.profile.name).toBe("Captain");
  });

  it("reuses unchanged confirmations after an unrelated profile edit or storage event", () => {
    const base = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const next = commitStoredData(
      base,
      { ...base, profile: { ...base.profile, name: "Captain" } },
      storage,
    );
    expect(next.streak).toBe(base.streak);
    expect(readStoredData(storage, next).data.streak).toBe(next.streak);
  });

  it("keeps future unsupported versions read-only even with a usable recovery copy", () => {
    const raw = JSON.stringify({
      ...withDays(),
      version: CURRENT_APP_DATA_VERSION + 1,
      newData: ["must survive"],
    });
    const storage = memoryStorage({
      [STORAGE_KEY]: raw,
      [LAST_GOOD_KEY]: JSON.stringify(data()),
    });
    expect(readStoredData(storage).status).toBe("recovered");
    expect(() =>
      commitStoredMutation(
        data(),
        (current) => ({ ...current, streak: ledger() }),
        storage,
      ),
    ).toThrow(StorageRecoveryError);
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    expect(storage.writes).toEqual([]);
  });

  it("retains the persisted day and reports failure when a new confirmation exceeds quota", () => {
    const base = withDays({ date: "2026-11-01", status: "NO_SPEND" });
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const full = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const desired = withDays(...base.streak!.confirmedDays, {
      date: "2026-11-02",
      status: "NO_SPEND",
    });
    expect(() => commitStoredData(base, desired, full)).toThrow(
      "QuotaExceededError",
    );
    expect(readStoredData(storage).data).toEqual(base);
  });
});

describe("manual exchange-rate persistence", () => {
  const rates = { USD: 1 as const, EUR: 0.5, KZT: 500 };
  it("keeps manual rates when a stale tab changes unrelated profile fields", () => {
    const base = data();
    const remote: AppData = {
      ...base,
      version: 4,
      profile: { ...base.profile, exchangeRates: rates },
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const next = commitStoredData(
      base,
      { ...base, profile: { ...base.profile, name: "Captain" } },
      storage,
    );
    expect(next.version).toBe(4);
    expect(next.profile).toEqual({
      ...base.profile,
      name: "Captain",
      exchangeRates: rates,
    });
    expect(readStoredData(storage).data).toEqual(next);
  });
  it("retains version four while preserving accounting days through both commit paths", () => {
    const base: AppData = {
      ...data(),
      version: 4,
      profile: { ...data().profile, exchangeRates: rates },
      streak: {
        version: 1,
        startedOn: "2026-11-01",
        confirmedDays: [{ date: "2026-11-01", status: "NO_SPEND" }],
      },
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const first = commitStoredData(
      base,
      { ...base, profile: { ...base.profile, theme: "dark" } },
      storage,
    );
    const next = commitStoredMutation(
      first,
      (current) => ({ ...current, transactions: [] }),
      storage,
    );
    expect(next.version).toBe(4);
    expect(next.profile.exchangeRates).toEqual(rates);
    expect(next.streak).toEqual(base.streak);
  });
  it("rejects a competing rates edit and merges an unrelated theme edit", () => {
    const base = { ...data().profile, exchangeRates: rates };
    const remote = { ...base, exchangeRates: { ...rates, KZT: 600 } };
    expect(() =>
      mergeProfileDraft(base, remote, {
        ...base,
        exchangeRates: { ...rates, EUR: 0.8 },
      }),
    ).toThrow(DataConflictError);
    expect(mergeProfileDraft(base, remote, { ...base, theme: "dark" })).toEqual(
      { ...remote, theme: "dark" },
    );
  });
});

describe("atomic automatic-rate snapshots", () => {
  const rates = { USD: 1 as const, EUR: 0.9, KZT: 450 };
  const sync = {
    mode: "automatic" as const,
    source: "frankfurter" as const,
    checkedAt: "2026-11-11T12:00:00.000Z",
    dates: { EUR: "2026-11-10", KZT: "2026-11-09" },
  };
  it("prevents a stale manual rate editor from being merged with a remote automatic policy", () => {
    const base = { ...data().profile, exchangeRates: rates };
    const remote = {
      ...base,
      exchangeRateSync: { mode: "automatic" as const },
    };
    const draft = { ...base, exchangeRates: { ...rates, EUR: 0.8 } };
    expect(() => mergeProfileDraft(base, remote, draft)).toThrow(
      DataConflictError,
    );
    const original = { ...data(), profile: base };
    expect(() =>
      mergeAppData(
        original,
        { ...original, profile: remote },
        { ...original, profile: draft },
      ),
    ).toThrow(DataConflictError);
  });
  it("prevents a stale disable action from attaching manual policy to a newer provider snapshot", () => {
    const base = {
      ...data().profile,
      exchangeRates: rates,
      exchangeRateSync: { mode: "automatic" as const },
    };
    const remote = {
      ...base,
      exchangeRates: { ...rates, EUR: 0.89 },
      exchangeRateSync: sync,
    };
    expect(() =>
      mergeProfileDraft(base, remote, {
        ...base,
        exchangeRateSync: { mode: "manual" },
      }),
    ).toThrow(DataConflictError);
  });
  it("keeps the complete snapshot while an unrelated stale profile draft is saved", () => {
    const base = data();
    const remote: AppData = {
      ...base,
      version: 5,
      profile: {
        ...base.profile,
        exchangeRates: rates,
        exchangeRateSync: sync,
      },
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const next = commitStoredData(
      base,
      { ...base, profile: { ...base.profile, name: "Captain" } },
      storage,
    );
    expect(next.version).toBe(5);
    expect(next.profile).toEqual({ ...remote.profile, name: "Captain" });
    expect(readStoredData(storage).data).toEqual(next);
    expect(next.transactions).toBe(base.transactions);
    expect(
      mergeProfileDraft(base.profile, remote.profile, {
        ...base.profile,
        theme: "dark",
      }),
    ).toEqual({ ...remote.profile, theme: "dark" });
  });
});

describe("mutations recomputed against the latest primary", () => {
  const template = (): ShoppingTemplate => ({
    id: "weekly",
    name: "Weekly",
    items: [{ title: "Milk", currency: "EUR" }],
  });
  const baseData = (): AppData => ({
    ...data(),
    version: 2,
    shoppingTemplates: [template()],
  });
  const planned = (id: string, title = "Milk") => ({
    id,
    title,
    currency: "EUR" as const,
    createdAt: "2026-11-03",
  });

  it("rejects a template deleted before the storage event reaches this tab", () => {
    const base = baseData();
    const remote = { ...base, shoppingTemplates: [] };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    expect(() =>
      commitStoredMutation(
        base,
        (fresh) => applyShoppingTemplate(fresh, "weekly"),
        storage,
      ),
    ).toThrow(/удалён/);
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(remote);
  });

  it("deduplicates against a planned product added before a delayed storage event", () => {
    const base = baseData();
    const remote = { ...base, shoppingList: [planned("remote")] };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const saved = commitStoredMutation(
      base,
      (fresh) => applyShoppingTemplate(fresh, "weekly"),
      storage,
    );
    expect(saved.shoppingList).toEqual(remote.shoppingList);
    expect(saved.transactions).toBe(base.transactions);
    expect(saved.profile).toBe(base.profile);
    expect(saved.shoppingTemplates).toBe(base.shoppingTemplates);
  });

  it("uses the latest template contents and does not restore stale planned products", () => {
    const base = { ...baseData(), shoppingList: [planned("removed", "Bread")] };
    const remote: AppData = {
      ...base,
      shoppingList: [],
      shoppingTemplates: [
        { ...template(), items: [{ title: "Eggs", currency: "USD" }] },
      ],
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const saved = commitStoredMutation(
      base,
      (fresh) => applyShoppingTemplate(fresh, "weekly"),
      storage,
    );
    expect(saved.shoppingList).toEqual([
      {
        id: expect.any(String),
        title: "Eggs",
        currency: "USD",
        createdAt: expect.any(String),
      },
    ]);
    expect(saved.shoppingTemplates).toEqual(remote.shoppingTemplates);
  });

  it("checks the current twentieth template and the current plan when saving a new template", () => {
    const base = { ...baseData(), shoppingList: [planned("stale", "Bread")] };
    const remote = {
      ...base,
      shoppingList: [planned("fresh", "Eggs")],
      shoppingTemplates: Array.from({ length: 20 }, (_, index) => ({
        ...template(),
        id: String(index),
      })),
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const save = (fresh: AppData): AppData => ({
      ...fresh,
      shoppingTemplates: [
        ...(fresh.shoppingTemplates ?? []),
        makeShoppingTemplate("New", fresh),
      ],
    });
    expect(() => commitStoredMutation(base, save, storage)).toThrow(/20/);
    expect(storage.writes).toEqual([]);
    const smaller = {
      ...remote,
      shoppingTemplates: remote.shoppingTemplates.slice(0, 19),
    };
    storage.values.set(STORAGE_KEY, JSON.stringify(smaller));
    const saved = commitStoredMutation(base, save, storage);
    expect(saved.shoppingTemplates).toHaveLength(20);
    expect(saved.shoppingTemplates!.at(-1)!.items).toEqual([
      { title: "Eggs", currency: "EUR" },
    ]);
  });

  it("checks the latest list capacity before applying any products", () => {
    const base = baseData();
    base.shoppingTemplates![0].items.push({ title: "Cheese", currency: "EUR" });
    const remote = {
      ...base,
      shoppingList: Array.from({ length: 999 }, (_, index) =>
        planned(String(index), `Product ${index}`),
      ),
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    expect(() =>
      commitStoredMutation(
        base,
        (fresh) => applyShoppingTemplate(fresh, "weekly"),
        storage,
      ),
    ).toThrow(/1000/);
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data.shoppingList).toHaveLength(999);
  });

  it("recomputes deduplication when a matching product arrives immediately before the write", () => {
    const base = baseData();
    const remote = { ...base, shoppingList: [planned("remote")] };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    let updates = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, JSON.stringify(remote));
        return storage.getItem(key);
      },
    };
    const saved = commitStoredMutation(
      base,
      (fresh) => {
        updates += 1;
        return applyShoppingTemplate(fresh, "weekly");
      },
      racing,
    );
    expect(updates).toBe(2);
    expect(saved.shoppingList).toEqual(remote.shoppingList);
    expect(storage.writes.filter(([key]) => key === STORAGE_KEY)).toHaveLength(
      1,
    );
  });

  it("rejects a template removed during a write retry instead of adding its former products", () => {
    const base = baseData();
    const remote = { ...base, shoppingTemplates: [] };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, JSON.stringify(remote));
        return storage.getItem(key);
      },
    };
    expect(() =>
      commitStoredMutation(
        base,
        (fresh) => applyShoppingTemplate(fresh, "weekly"),
        racing,
      ),
    ).toThrow(/удалён/);
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(remote);
  });

  it("keeps the recovery guard and validates a fresh mutation before any write", () => {
    const base = baseData();
    const update = () => base;
    const damaged = memoryStorage({
      [STORAGE_KEY]: "{broken",
      [LAST_GOOD_KEY]: JSON.stringify(base),
    });
    expect(() => commitStoredMutation(base, update, damaged)).toThrow(
      StorageRecoveryError,
    );
    expect(damaged.writes).toEqual([]);
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    expect(() =>
      commitStoredMutation(
        base,
        (fresh) => ({
          ...fresh,
          categoryBudgets: [{ id: "food", amount: -1, currency: "EUR" }],
        }),
        storage,
      ),
    ).toThrow();
    expect(storage.writes).toEqual([]);
  });
});

describe("category limit and shopping template persistence", () => {
  const limits = (): CategoryBudget[] => [
    { id: "food", amount: 200, currency: "EUR" },
    { id: "transport", amount: 80, currency: "USD" },
  ];
  const templates = (): ShoppingTemplate[] => [
    {
      id: "weekly",
      name: "Groceries",
      items: [{ title: "Bread", currency: "EUR" }],
    },
    {
      id: "home",
      name: "For home",
      items: [{ title: "Soap", currency: "KZT" }],
    },
  ];
  const extended = (): AppData => ({
    ...data(),
    version: 2,
    categoryBudgets: limits(),
    shoppingTemplates: templates(),
  });

  it("keeps optional legacy fields absent until a feature is used", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const desired = { ...base, profile: { ...base.profile, name: "Captain" } };
    const saved = commitStoredData(base, desired, storage);
    expect(saved).not.toHaveProperty("categoryBudgets");
    expect(saved).not.toHaveProperty("shoppingTemplates");
    expect(mergeAppData(base, copy(base), desired)).toEqual(saved);
  });

  it("upgrades once on feature creation and retains version two on subsequent saves and merges", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const upgraded = commitStoredData(
      base,
      { ...base, categoryBudgets: limits() },
      storage,
    );
    expect(upgraded.version).toBe(2);
    const saved = commitStoredData(
      upgraded,
      { ...upgraded, profile: { ...upgraded.profile, name: "Captain" } },
      storage,
    );
    expect(saved.version).toBe(2);
    const { categoryBudgets: _limits, ...noFeatures } = saved;
    expect(commitStoredData(saved, noFeatures, storage).version).toBe(2);
    expect(
      mergeAppData(
        base,
        { ...base, version: 2 },
        { ...base, profile: { ...base.profile, name: "Captain" } },
      ).version,
    ).toBe(2);
  });

  it("retains unchanged arrays and records on local saves and incoming storage updates", () => {
    const base = extended();
    const remote = { ...base, profile: { ...base.profile, name: "Captain" } };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const saved = commitStoredData(base, remote, storage);
    expect(saved.categoryBudgets).toBe(base.categoryBudgets);
    expect(saved.shoppingTemplates).toBe(base.shoppingTemplates);
    const incoming = readStoredData(storage, base).data;
    expect(incoming.categoryBudgets).toBe(base.categoryBudgets);
    expect(incoming.shoppingTemplates).toBe(base.shoppingTemplates);
    const changed = commitStoredData(
      saved,
      {
        ...saved,
        categoryBudgets: [
          { ...saved.categoryBudgets![0], amount: 250 },
          saved.categoryBudgets![1],
        ],
      },
      storage,
    );
    expect(changed.categoryBudgets![0].amount).toBe(250);
    expect(changed.categoryBudgets![1]).toBe(saved.categoryBudgets![1]);
    expect(changed.shoppingTemplates).toBe(saved.shoppingTemplates);
  });

  it("merges independent limit changes and profile edits across tabs", () => {
    const base = extended();
    const remote = copy(base);
    remote.categoryBudgets![0].amount = 250;
    const desired = copy(base);
    desired.categoryBudgets![1].amount = 100;
    desired.profile.language = "en";
    const saved = commitStoredData(
      base,
      desired,
      memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) }),
    );
    expect(saved.categoryBudgets).toEqual([
      { id: "food", amount: 250, currency: "EUR" },
      { id: "transport", amount: 100, currency: "USD" },
    ]);
    expect(saved.profile.language).toBe("en");
    expect(saved.shoppingTemplates).toEqual(base.shoppingTemplates);
  });

  it("rejects same-limit conflicts without writing either stored copy", () => {
    const base = extended();
    const remote = copy(base);
    const desired = copy(base);
    remote.categoryBudgets![0].amount = 250;
    desired.categoryBudgets![0].amount = 300;
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    expect(() => commitStoredData(base, desired, storage)).toThrow(
      DataConflictError,
    );
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(remote);
  });

  it("never combines a stale limit amount with a currency changed by another tab", () => {
    const base = extended();
    const remote = copy(base);
    remote.categoryBudgets![0].currency = "USD";
    const desired = copy(base);
    desired.categoryBudgets![0].amount = 300;
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    expect(() => commitStoredData(base, desired, storage)).toThrow(
      DataConflictError,
    );
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data.categoryBudgets).toEqual(
      remote.categoryBudgets,
    );
  });

  it("rejects a currency race detected immediately before committing a limit amount", () => {
    const base = extended();
    const remote = copy(base);
    remote.categoryBudgets![0].currency = "USD";
    const desired = copy(base);
    desired.categoryBudgets![0].amount = 300;
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, JSON.stringify(remote));
        return storage.getItem(key);
      },
    };
    expect(() => commitStoredData(base, desired, racing)).toThrow(
      DataConflictError,
    );
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data.categoryBudgets).toEqual(
      remote.categoryBudgets,
    );
  });

  it("accepts identical concurrent limits without inventing a conflict", () => {
    const base = extended();
    const remote = copy(base);
    remote.categoryBudgets![0] = { id: "food", amount: 300, currency: "USD" };
    expect(mergeAppData(base, remote, copy(remote)).categoryBudgets).toEqual(
      remote.categoryBudgets,
    );
    expect(
      mergeCategoryBudgetsDraft(
        base.categoryBudgets!,
        remote.categoryBudgets!,
        copy(remote.categoryBudgets!),
      ),
    ).toEqual(remote.categoryBudgets);
  });

  it("merges simultaneous first feature use without dropping another tab records", () => {
    const base = data();
    const remote = {
      ...base,
      categoryBudgets: [limits()[0]],
      shoppingTemplates: [templates()[0]],
    };
    const desired = {
      ...base,
      categoryBudgets: [limits()[1]],
      shoppingTemplates: [templates()[1]],
    };
    const merged = mergeAppData(base, remote, desired);
    expect(merged.categoryBudgets).toEqual(limits());
    expect(merged.shoppingTemplates).toEqual(templates());
    expect(
      mergeAppData(base, remote, {
        ...base,
        profile: { ...base.profile, name: "Captain" },
      }),
    ).toMatchObject({
      categoryBudgets: remote.categoryBudgets,
      shoppingTemplates: remote.shoppingTemplates,
    });
  });

  it("preserves template edits and deletions during unrelated profile and expense saves", () => {
    const base = extended();
    const remote = copy(base);
    remote.shoppingTemplates![0].name = "Market";
    remote.shoppingTemplates![0].items.push({ title: "Milk", currency: "USD" });
    remote.shoppingTemplates!.splice(1, 1);
    const desired = copy(base);
    desired.profile.name = "Captain";
    desired.transactions[0].note = "Dinner";
    const saved = commitStoredData(
      base,
      desired,
      memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) }),
    );
    expect(saved.shoppingTemplates).toEqual(remote.shoppingTemplates);
    expect(saved.profile.name).toBe("Captain");
    expect(saved.transactions[0].note).toBe("Dinner");
  });

  it("merges independent template fields and rejects competing item lists or stale deletions", () => {
    const base = extended();
    const remote = copy(base);
    remote.shoppingTemplates![0].name = "Market";
    const desired = copy(base);
    desired.shoppingTemplates![0].items.push({
      title: "Milk",
      currency: "USD",
    });
    const merged = mergeAppData(base, remote, desired);
    expect(merged.shoppingTemplates![0]).toEqual({
      ...desired.shoppingTemplates![0],
      name: "Market",
    });
    remote.shoppingTemplates![0].items.push({ title: "Eggs", currency: "EUR" });
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
    expect(() =>
      mergeAppData(base, remote, {
        ...base,
        shoppingTemplates: base.shoppingTemplates!.slice(1),
      }),
    ).toThrow(DataConflictError);
  });

  it("keeps stable record ordering on the fast path and records explicit feature removal", () => {
    const base = extended();
    const desired = {
      ...base,
      categoryBudgets: [...limits()].reverse(),
      shoppingTemplates: [...templates()].reverse(),
    };
    const saved = commitStoredData(
      base,
      desired,
      memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) }),
    );
    expect(saved.categoryBudgets).toEqual(base.categoryBudgets);
    expect(saved.shoppingTemplates).toEqual(base.shoppingTemplates);
    expect(saved).toEqual(mergeAppData(base, copy(base), desired));
    const {
      categoryBudgets: _limits,
      shoppingTemplates: _templates,
      ...removed
    } = base;
    const cleared = commitStoredData(
      base,
      removed,
      memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) }),
    );
    expect(cleared.categoryBudgets).toEqual([]);
    expect(cleared.shoppingTemplates).toEqual([]);
    expect(cleared).toEqual(mergeAppData(base, copy(base), removed));
  });

  it("rebases a category modal and preserves other category additions and removals", () => {
    const base = limits();
    const current: CategoryBudget[] = [
      base[0],
      { id: "home", amount: 100, currency: "EUR" },
    ];
    const draft = [{ ...base[0], amount: 300 }, base[1]];
    expect(mergeCategoryBudgetsDraft(base, current, draft)).toEqual([
      { id: "food", amount: 300, currency: "EUR" },
      current[1],
    ]);
    expect(base).toEqual(limits());
  });

  it("rejects independently changed amount and currency for the same category in a stale modal", () => {
    const base = limits();
    const current: CategoryBudget[] = [
      { ...base[0], currency: "KZT" },
      base[1],
    ];
    const draft = [{ ...base[0], amount: 300 }, base[1]];
    expect(() => mergeCategoryBudgetsDraft(base, current, draft)).toThrow(
      DataConflictError,
    );
    expect(base).toEqual(limits());
    expect(current[0]).toEqual({ id: "food", amount: 200, currency: "KZT" });
  });

  it("rejects conflicting or invalid category modal changes without validating unrelated history", () => {
    const base = limits();
    expect(() =>
      mergeCategoryBudgetsDraft(
        base,
        [{ ...base[0], amount: 250 }],
        [{ ...base[0], amount: 300 }],
      ),
    ).toThrow(DataConflictError);
    expect(() =>
      mergeCategoryBudgetsDraft(base, base.slice(1), [
        { ...base[0], amount: 300 },
        base[1],
      ]),
    ).toThrow(DataConflictError);
    expect(() =>
      mergeCategoryBudgetsDraft(base, base, [{ ...base[0], amount: 0.001 }]),
    ).toThrow();
    expect(mergeCategoryBudgetsDraft(base, base, [])).toEqual([]);
  });
});

describe("single-commit persistence", () => {
  it("keeps equal ledger and shopping arrays stable on a profile-only save", () => {
    const base = {
      ...data(),
      shoppingList: [
        {
          id: "plan",
          title: "Bread",
          currency: "EUR" as const,
          createdAt: "2026-11-03",
        },
      ],
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const desired = { ...base, profile: { ...base.profile, name: "Captain" } };
    const saved = commitStoredData(base, desired, storage);
    expect(saved.profile.name).toBe("Captain");
    expect(saved.transactions).toBe(base.transactions);
    expect(saved.shoppingList).toBe(base.shoppingList);
    expect(readStoredData(storage).data).toEqual(saved);
    expect(base.profile.name).not.toBe("Captain");
  });

  it("keeps unchanged records stable when a storage event reads a remote profile change", () => {
    const base = data();
    const remote = {
      ...base,
      profile: { ...base.profile, language: "en" as const },
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const incoming = readStoredData(storage, base);
    expect(incoming.data.profile.language).toBe("en");
    expect(incoming.data.transactions).toBe(base.transactions);
    expect(storage.writes).toEqual([]);
  });

  it("reuses equal records while saving changed records and canonicalizing inputs", () => {
    const base = data();
    base.transactions.push(expense({ id: "unchanged" }));
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const desired = {
      ...base,
      transactions: [
        { ...base.transactions[0], title: "  Market  " },
        base.transactions[1],
      ],
    };
    const saved = commitStoredData(base, desired, storage);
    expect(saved.transactions).not.toBe(base.transactions);
    expect(saved.transactions[0]).toMatchObject({ title: "Market" });
    expect(saved.transactions[0]).not.toBe(desired.transactions[0]);
    expect(saved.transactions[1]).toBe(base.transactions[1]);
    expect(desired.transactions[0].title).toBe("  Market  ");
    expect(readStoredData(storage).data).toEqual(saved);
  });

  it("merges a newer persisted expense before saving a local profile change", () => {
    const base = data();
    const remote = copy(base);
    remote.transactions[0].amount = 40;
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(remote) });
    const saved = commitStoredData(
      base,
      { ...base, profile: { ...base.profile, name: "Captain" } },
      storage,
    );
    expect(saved.profile.name).toBe("Captain");
    expect(saved.transactions[0].amount).toBe(40);
  });

  it("retains merge ordering and legacy shopping shape on the fast path", () => {
    const base = {
      ...data(),
      shoppingList: [
        {
          id: "plan",
          title: "Bread",
          currency: "EUR" as const,
          createdAt: "2026-11-03",
        },
      ],
    };
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const { shoppingList: _shopping, ...desired } = {
      ...base,
      transactions: [expense({ id: "new" }), ...base.transactions],
    };
    const saved = commitStoredData(base, desired, storage);
    expect(saved).toEqual(mergeAppData(base, copy(base), desired));
    expect(saved.transactions.map(({ id }) => id)).toEqual(["expense", "new"]);
    expect(saved.shoppingList).toEqual([]);
  });

  it("rechecks the primary and merges an edit made while the candidate was prepared", () => {
    const base = data();
    const remote = copy(base);
    remote.transactions[0].amount = 40;
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, JSON.stringify(remote));
        return storage.getItem(key);
      },
    };
    const desired = {
      ...base,
      transactions: [{ ...base.transactions[0], title: "Market" }],
    };
    const saved = commitStoredData(base, desired, racing);
    expect(saved.transactions[0]).toMatchObject({
      title: "Market",
      amount: 40,
    });
    expect(storage.writes.filter(([key]) => key === STORAGE_KEY)).toHaveLength(
      1,
    );
  });

  it("does not overwrite a same-field conflict that appears just before the write", () => {
    const base = data();
    const remote = copy(base);
    remote.transactions[0].title = "Remote market";
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, JSON.stringify(remote));
        return storage.getItem(key);
      },
    };
    const desired = {
      ...base,
      transactions: [{ ...base.transactions[0], title: "Local market" }],
    };
    expect(() => commitStoredData(base, desired, racing)).toThrow(
      DataConflictError,
    );
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(remote);
  });

  it("stops repeated racing writes instead of discarding another tab changes", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY)
          storage.values.set(
            key,
            JSON.stringify({
              ...base,
              profile: { ...base.profile, monthlyBudget: ++reads },
            }),
          );
        return storage.getItem(key);
      },
    };
    expect(() =>
      commitStoredData(
        base,
        { ...base, profile: { ...base.profile, name: "Captain" } },
        racing,
      ),
    ).toThrow(DataConflictError);
    expect(storage.writes).toEqual([]);
  });

  it("preserves corruption introduced immediately before a save", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    let reads = 0;
    const racing = {
      ...storage,
      getItem: (key: string) => {
        if (key === STORAGE_KEY && ++reads === 2)
          storage.values.set(key, "{damaged");
        return storage.getItem(key);
      },
    };
    expect(() =>
      commitStoredData(
        base,
        { ...base, profile: { ...base.profile, name: "Captain" } },
        racing,
      ),
    ).toThrow(StorageRecoveryError);
    expect(storage.values.get(STORAGE_KEY)).toBe("{damaged");
    expect(storage.writes).toEqual([]);
  });

  it("does not trust a previously validated object after its caller mutates it", () => {
    const base = data();
    const storage = memoryStorage();
    const saved = commitStoredData(createEmptyData(), base, storage);
    const raw = storage.values.get(STORAGE_KEY);
    const writes = storage.writes.length;
    saved.transactions[0].amount = 0;
    expect(() =>
      commitStoredData(
        saved,
        { ...saved, profile: { ...saved.profile, name: "Captain" } },
        storage,
      ),
    ).toThrow();
    expect(() => writeStoredData(saved, storage)).toThrow();
    expect(storage.values.get(STORAGE_KEY)).toBe(raw);
    expect(storage.writes).toHaveLength(writes);
  });

  it("does not reuse a primary validation after its raw string changes", () => {
    const storage = memoryStorage();
    writeStoredData(data(), storage);
    storage.values.set(STORAGE_KEY, "{damaged");
    const writes = storage.writes.length;
    expect(() => writeStoredData(data(), storage)).toThrow(
      StorageRecoveryError,
    );
    expect(storage.values.get(STORAGE_KEY)).toBe("{damaged");
    expect(storage.writes).toHaveLength(writes);
  });

  it("keeps corruption blocked and archives it only on explicit replacement", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "{original" });
    expect(() => commitStoredData(createEmptyData(), data(), storage)).toThrow(
      StorageRecoveryError,
    );
    expect(storage.writes).toEqual([]);
    expect(
      commitStoredData(createEmptyData(), data(), storage, {
        replaceCorrupt: true,
      }),
    ).toEqual(data());
    expect(storage.values.get(CORRUPT_KEY)).toBe("{original");
  });

  it("reports a failed primary commit without exposing the candidate as saved", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const blocked = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() =>
      commitStoredData(
        base,
        { ...base, profile: { ...base.profile, name: "Captain" } },
        blocked,
      ),
    ).toThrow("QuotaExceededError");
    expect(readStoredData(storage).data).toEqual(base);
  });

  it("validates limits on the uncontended fast path", () => {
    const base = data();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const invalid = {
      ...base,
      profile: { ...base.profile, monthlyBudget: MAX_AMOUNT + 1 },
    };
    expect(() => commitStoredData(base, invalid, storage)).toThrow();
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(base);
  });

  it("rejects a valid object whose serialized form would exceed the readable backup limit", () => {
    const base = createEmptyData();
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(base) });
    const desired: AppData = {
      ...base,
      transactions: Array.from({ length: 15_000 }, (_, index) =>
        expense({ id: `expense-${index}`, note: "n".repeat(2_000) }),
      ),
    };
    expect(JSON.stringify(desired).length).toBeGreaterThan(MAX_BACKUP_LENGTH);
    expect(() => commitStoredData(base, desired, storage)).toThrow(
      "слишком большой",
    );
    expect(() => writeStoredData(desired, storage)).toThrow("слишком большой");
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(base);
  });
});

describe("profile-only editor merge", () => {
  it("merges disjoint edits and preserves unrelated current settings", () => {
    const base = data().profile;
    expect(
      mergeProfileDraft(
        base,
        { ...base, language: "en", theme: "dark" },
        { ...base, name: "Captain" },
      ),
    ).toMatchObject({ name: "Captain", language: "en", theme: "dark" });
    expect(base.name).not.toBe("Captain");
  });

  it("rejects same-field conflicts and invalid profiles", () => {
    const base = data().profile;
    expect(() =>
      mergeProfileDraft(
        base,
        { ...base, name: "Remote" },
        { ...base, name: "Local" },
      ),
    ).toThrow(DataConflictError);
    expect(() =>
      mergeProfileDraft(base, base, { ...base, monthlyBudget: MAX_AMOUNT + 1 }),
    ).toThrow();
    expect(() =>
      mergeProfileDraft({ ...base, monthlyBudget: -1 }, base, base),
    ).toThrow();
  });
});
describe("recoverable local persistence", () => {
  it("reads an empty or valid store without writing anything", () => {
    const storage = memoryStorage();
    expect(readStoredData(storage)).toEqual({
      status: "empty",
      data: createEmptyData(),
    });
    storage.values.set(STORAGE_KEY, JSON.stringify(data()));
    expect(readStoredData(storage)).toEqual({ status: "ready", data: data() });
    expect(storage.writes).toEqual([]);
  });

  it.each([
    "{broken",
    "",
    JSON.stringify({ ...data(), transactions: [expense({ amount: 0 })] }),
  ])(
    "preserves invalid primary data verbatim without allowing an automatic overwrite",
    (raw) => {
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      expect(readStoredData(storage)).toEqual({
        status: "corrupt",
        data: createEmptyData(),
        raw,
      });
      expect(() => writeStoredData(createEmptyData(), storage)).toThrow(
        StorageRecoveryError,
      );
      expect(storage.values.get(STORAGE_KEY)).toBe(raw);
      expect(storage.writes).toEqual([]);
    },
  );

  it("returns the last good snapshot while retaining the damaged original", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: "damaged",
      [LAST_GOOD_KEY]: JSON.stringify(data()),
    });
    expect(readStoredData(storage)).toEqual({
      status: "recovered",
      data: data(),
      raw: "damaged",
    });
    expect(storage.values.get(STORAGE_KEY)).toBe("damaged");
    expect(storage.writes).toEqual([]);
    expect(() => writeStoredData(data(), storage)).toThrow(
      StorageRecoveryError,
    );
  });

  it("ignores a damaged last-good copy and leaves both originals intact", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: "{primary",
      [LAST_GOOD_KEY]: "{secondary",
    });
    expect(readStoredData(storage).status).toBe("corrupt");
    expect(storage.writes).toEqual([]);
  });

  it("archives a damaged primary before an explicitly requested replacement", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "original damaged data" });
    writeStoredData(data(), storage, { replaceCorrupt: true });
    expect(storage.writes.map(([key]) => key)).toEqual([
      CORRUPT_KEY,
      STORAGE_KEY,
      LAST_GOOD_KEY,
    ]);
    expect(storage.values.get(CORRUPT_KEY)).toBe("original damaged data");
    expect(readStoredData(storage)).toEqual({ status: "ready", data: data() });
  });

  it("does not overwrite the primary when archiving fails", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: "original" });
    const failArchive = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === CORRUPT_KEY) throw new Error("QuotaExceededError");
        storage.setItem(key, value);
      },
    };
    expect(() =>
      writeStoredData(data(), failArchive, { replaceCorrupt: true }),
    ).toThrow("QuotaExceededError");
    expect(storage.values.get(STORAGE_KEY)).toBe("original");
    expect(storage.writes).toEqual([]);
  });

  it("rejects invalid state before any storage access or write", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(data()) });
    expect(() =>
      writeStoredData(
        { ...data(), transactions: [expense({ amount: NaN })] },
        storage,
      ),
    ).toThrow();
    expect(storage.writes).toEqual([]);
    expect(readStoredData(storage).data).toEqual(data());
  });

  it("propagates primary write failure and retains the last persisted state", () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(data()) });
    const blocked = {
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => writeStoredData(createEmptyData(), blocked)).toThrow(
      "QuotaExceededError",
    );
    expect(readStoredData(storage).data).toEqual(data());
  });

  it("counts a successful primary commit as saved even when the secondary copy is full", () => {
    const storage = memoryStorage();
    const secondaryFull = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (key === LAST_GOOD_KEY) throw new Error("QuotaExceededError");
        storage.setItem(key, value);
      },
    };
    expect(() => writeStoredData(data(), secondaryFull)).not.toThrow();
    expect(readStoredData(storage)).toEqual({ status: "ready", data: data() });
  });

  it("reports a blocked store and never pretends that a write succeeded", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readStoredData(blocked)).toEqual({
      status: "unavailable",
      data: createEmptyData(),
    });
    expect(() => writeStoredData(data(), blocked)).toThrow("SecurityError");
  });
});

describe("three-way concurrent data changes", () => {
  it("keeps remote changes when the local snapshot is untouched", () => {
    const base = data();
    const remote = copy(base);
    remote.transactions[0].amount = 40;
    expect(mergeAppData(base, remote, base)).toEqual(remote);
    expect(base.transactions[0].amount).toBe(25);
  });

  it("combines disjoint profile fields and disjoint transaction fields", () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.profile.language = "en";
    remote.transactions[0].amount = 40;
    remote.transactions[0].items = [{ id: "bread", title: "Bread", amount: 2 }];
    desired.profile.name = "Captain";
    desired.transactions[0].title = "Market";
    const merged = mergeAppData(base, remote, desired);
    expect(merged.profile).toMatchObject({ name: "Captain", language: "en" });
    expect(merged.transactions[0]).toMatchObject({
      title: "Market",
      amount: 40,
      items: remote.transactions[0].items,
    });
  });

  it("preserves independent additions from two tabs, maintaining current order", () => {
    const base = data();
    const remote = {
      ...copy(base),
      transactions: [expense({ id: "remote" }), ...base.transactions],
    };
    const desired = {
      ...copy(base),
      transactions: [expense({ id: "local" }), ...base.transactions],
    };
    expect(
      mergeAppData(base, remote, desired).transactions.map(({ id }) => id),
    ).toEqual(["remote", "expense", "local"]);
  });

  it("accepts identical concurrent edits and additions only once", () => {
    const base = data();
    const desired = copy(base);
    desired.transactions[0].amount = 30;
    desired.transactions.push(expense({ id: "new" }));
    expect(mergeAppData(base, copy(desired), desired)).toEqual(desired);
  });

  it("rejects different edits to the same field or the same newly added ID", () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.transactions[0].amount = 30;
    desired.transactions[0].amount = 40;
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
    remote.transactions = [expense({ id: "new", amount: 30 })];
    desired.transactions = [expense({ id: "new", amount: 40 })];
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
  });

  it("rejects conflicting profile fields", () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.profile.name = "First";
    desired.profile.name = "Second";
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
  });

  it("merges optional field deletion and preserves unrelated fields", () => {
    const base = data();
    base.transactions[0].note = "Old note";
    const remote = copy(base);
    const desired = copy(base);
    remote.transactions[0].amount = 30;
    delete desired.transactions[0].note;
    const merged = mergeAppData(base, remote, desired);
    expect(merged.transactions[0].note).toBeUndefined();
    expect(merged.transactions[0].amount).toBe(30);
  });

  it("keeps remote deletions when local records are unchanged", () => {
    const base = data();
    const remote = { ...copy(base), transactions: [] };
    const desired = copy(base);
    desired.profile.name = "New name";
    expect(mergeAppData(base, remote, desired).transactions).toEqual([]);
  });

  it("rejects dirty updates to remotely deleted records and deletion of remotely edited records", () => {
    const base = data();
    const remote = { ...copy(base), transactions: [] };
    const desired = copy(base);
    desired.transactions[0].title = "New title";
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
    expect(() => mergeAppData(base, desired, remote)).toThrow(
      DataConflictError,
    );
  });

  it("applies a local deletion without removing a remote addition", () => {
    const base = data();
    const remote = {
      ...copy(base),
      transactions: [...base.transactions, expense({ id: "remote" })],
    };
    const desired = { ...copy(base), transactions: [] };
    expect(
      mergeAppData(base, remote, desired).transactions.map(({ id }) => id),
    ).toEqual(["remote"]);
  });

  it("treats purchase details as an atomic field and rejects simultaneous different detail edits", () => {
    const base = data();
    const remote = copy(base);
    const desired = copy(base);
    remote.transactions[0].items = [{ id: "bread", title: "Bread", amount: 2 }];
    desired.transactions[0].items = [{ id: "milk", title: "Milk", amount: 3 }];
    expect(() => mergeAppData(base, remote, desired)).toThrow(
      DataConflictError,
    );
  });

  it("preserves absent legacy shopping lists and handles explicit empty lists", () => {
    const base = data();
    expect(mergeAppData(base, base, base).shoppingList).toBeUndefined();
    expect(
      mergeAppData(base, base, { ...base, shoppingList: [] }).shoppingList,
    ).toEqual([]);
  });

  it("normalizes imported linked shopping metadata against the surviving expense", () => {
    const base = data();
    const desired = {
      ...copy(base),
      shoppingList: [
        {
          id: "product",
          title: "Stale title",
          currency: "USD" as const,
          createdAt: "2026-11-03",
          transactionId: "expense",
        },
      ],
    };
    const merged = mergeAppData(base, base, desired);
    expect(merged.shoppingList![0]).toMatchObject({
      title: "Groceries",
      currency: "EUR",
      transactionId: "expense",
    });
  });

  it("validates the merged transaction limit before exposing state", () => {
    const base = createEmptyData();
    const half = MAX_TRANSACTIONS / 2;
    const remote = {
      ...base,
      transactions: Array.from({ length: half + 1 }, (_, index) =>
        expense({ id: `r${index}` }),
      ),
    };
    const desired = {
      ...base,
      transactions: Array.from({ length: half }, (_, index) =>
        expense({ id: `l${index}` }),
      ),
    };
    expect(() => mergeAppData(base, remote, desired)).toThrow();
  });

  it("rejects an invalid converted budget before persisting a merge", () => {
    const base = data();
    const desired = {
      ...base,
      profile: { ...base.profile, monthlyBudget: MAX_AMOUNT + 1 },
    };
    expect(() => mergeAppData(base, base, desired)).toThrow();
  });
});

describe("stale transaction editors", () => {
  it("changes a title without reverting a newer price, currency or purchase details", () => {
    const base = expense();
    const current = expense({
      amount: 40,
      currency: "USD",
      items: [{ id: "bread", title: "Bread", amount: 2 }],
    });
    expect(
      mergeTransactionDraft(base, current, { ...base, title: "Market" }),
    ).toEqual({ ...current, title: "Market" });
  });

  it("rejects a same-field conflict and editing a deleted transaction", () => {
    const base = expense();
    expect(() =>
      mergeTransactionDraft(base, expense({ amount: 30 }), {
        ...base,
        amount: 40,
      }),
    ).toThrow(DataConflictError);
    expect(() => mergeTransactionDraft(base, undefined, base)).toThrow(
      DataConflictError,
    );
  });

  it("rejects an amount edit that would invalidate newly added purchase details", () => {
    const base = expense();
    const current = expense({
      items: [{ id: "bread", title: "Bread", amount: 20 }],
    });
    expect(() =>
      mergeTransactionDraft(base, current, { ...base, amount: 10 }),
    ).toThrow();
  });
});

describe("shared strict money input", () => {
  it.each([
    ["12.50", 12.5],
    ["12,50", 12.5],
    [" 1 234,56 ", 1234.56],
    ["1\u00a0234.50", 1234.5],
    ["1\u202f234", 1234],
    ["0.01", 0.01],
    ["1000000000000", MAX_AMOUNT],
  ])("parses %s as %s", (input, amount) =>
    expect(parseMoney(input)).toBe(amount),
  );

  it.each([
    "",
    "0",
    "-1",
    "+1",
    ".1",
    "1.",
    "1.234",
    "1e2",
    "0x10",
    "Infinity",
    "NaN",
    "1,234.56",
    "12 34",
    "1000000000000.01",
  ])("rejects ambiguous or invalid input %s", (input) =>
    expect(parseMoney(input)).toBeNull(),
  );

  it("permits zero only for explicitly optional budgets", () => {
    expect(parseMoney("0", true)).toBe(0);
    expect(parseMoney("0.00", true)).toBe(0);
    expect(parseMoney("-0", true)).toBeNull();
  });
});
