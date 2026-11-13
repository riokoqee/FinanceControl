import { describe, expect, it } from "vitest";
import { createEmptyData, STORAGE_KEY } from "../finance";
import {
  CORRUPT_KEY,
  LAST_GOOD_KEY,
  PRE_REPLACE_KEY,
  commitStoredData,
  hasPreReplaceData,
  readPreReplaceData,
  writeStoredData,
} from "./storage";

const original = () => ({
  ...createEmptyData(),
  profile: { ...createEmptyData().profile, name: "Before" },
});
function memory(initial: Record<string, string> = {}, capacity = Infinity) {
  const values = new Map(Object.entries(initial));
  const attempts: string[] = [];
  const failures: DOMException[] = [];
  const removed: string[] = [];
  return {
    values,
    attempts,
    failures,
    removed,
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      removed.push(key);
      values.delete(key);
    },
    setItem(key: string, value: string) {
      attempts.push(key);
      const used = [...values].reduce(
        (sum, [name, raw]) => sum + (name === key ? 0 : raw.length),
        0,
      );
      if (used + value.length > capacity) {
        const error = new DOMException("Storage is full", "QuotaExceededError");
        failures.push(error);
        throw error;
      }
      values.set(key, value);
    },
  };
}

describe("quota-limited primary commits", () => {
  it("rechecks a competing tab before the quota retry and merges its newer profile", () => {
    const before = original();
    const raw = JSON.stringify(before);
    const storage = memory({ [STORAGE_KEY]: raw, [LAST_GOOD_KEY]: raw });
    const remote = {
      ...before,
      profile: { ...before.profile, currency: "EUR" as const },
    };
    let first = true;
    const adapter = {
      ...storage,
      setItem(key: string, value: string) {
        if (key === STORAGE_KEY && first) {
          first = false;
          storage.values.set(STORAGE_KEY, JSON.stringify(remote));
          throw new DOMException("Full", "QuotaExceededError");
        }
        storage.setItem(key, value);
      },
    };
    const next = commitStoredData(
      before,
      { ...before, profile: { ...before.profile, name: "My new name" } },
      adapter,
    );
    expect(next.profile.currency).toBe("EUR");
    expect(next.profile.name).toBe("My new name");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(next);
  });
  it("evicts only last-good and saves the primary when duplicate data fills storage", () => {
    const before = original();
    const raw = JSON.stringify(before);
    const storage = memory(
      { [STORAGE_KEY]: raw, [LAST_GOOD_KEY]: raw, unrelated: "keep" },
      raw.length * 2 + 4,
    );
    const next = {
      ...before,
      profile: { ...before.profile, name: "A longer saved profile" },
    };
    expect(commitStoredData(before, next, storage)).toEqual(next);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(next);
    expect(storage.removed).toEqual([LAST_GOOD_KEY]);
    expect(storage.getItem(LAST_GOOD_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
    expect(storage.attempts.filter((key) => key === STORAGE_KEY)).toHaveLength(
      2,
    );
  });

  it("throws the original quota exception when the single retry also fails and retains the primary", () => {
    const before = original();
    const raw = JSON.stringify(before);
    const storage = memory(
      { [STORAGE_KEY]: raw, [LAST_GOOD_KEY]: raw },
      raw.length * 2,
    );
    const oversized = {
      ...before,
      transactions: Array.from({ length: 20 }, (_, index) => ({
        id: String(index),
        title: "Large purchase",
        category: "food" as const,
        amount: 10,
        currency: "USD" as const,
        date: "2026-11-13",
      })),
    };
    let thrown;
    try {
      writeStoredData(oversized, storage);
    } catch (error) {
      thrown = error;
    }
    expect(storage.failures).toHaveLength(2);
    expect(thrown).toBe(storage.failures[0]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.removed).toEqual([LAST_GOOD_KEY]);
    expect(storage.attempts).toEqual([STORAGE_KEY, STORAGE_KEY]);
  });

  it("rebuilds last-good after a successful retry when space permits", () => {
    const before = original();
    const raw = JSON.stringify(before);
    const storage = memory({ [STORAGE_KEY]: raw, [LAST_GOOD_KEY]: raw });
    const quota = new DOMException(
      "Temporary quota limit",
      "QuotaExceededError",
    );
    let calls = 0;
    const adapter = {
      ...storage,
      setItem(key: string, value: string) {
        if (key === STORAGE_KEY && calls++ === 0) throw quota;
        storage.setItem(key, value);
      },
    };
    writeStoredData(before, adapter);
    expect(calls).toBe(2);
    expect(storage.getItem(LAST_GOOD_KEY)).toBe(raw);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("does not evict a recovery copy on non-quota failures", () => {
    const raw = JSON.stringify(original());
    const storage = memory({ [STORAGE_KEY]: raw, [LAST_GOOD_KEY]: raw });
    const error = new DOMException("Blocked", "SecurityError");
    expect(() =>
      writeStoredData(original(), {
        ...storage,
        setItem() {
          throw error;
        },
      }),
    ).toThrow(error);
    expect(storage.removed).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(LAST_GOOD_KEY)).toBe(raw);
  });

  it("preserves the original exception if removing last-good fails", () => {
    const raw = JSON.stringify(original());
    const storage = memory({ [STORAGE_KEY]: raw });
    const quota = new DOMException("Full", "QuotaExceededError");
    expect(() =>
      writeStoredData(original(), {
        ...storage,
        setItem() {
          throw quota;
        },
        removeItem() {
          throw new Error("Blocked removal");
        },
      }),
    ).toThrow(quota);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
});

describe("one pre-replacement snapshot", () => {
  it("keeps the exact valid primary before replacement, independently of last-good", () => {
    const raw = JSON.stringify(original(), null, 2);
    const storage = memory({ [STORAGE_KEY]: raw });
    writeStoredData(createEmptyData(), storage, { replaceCorrupt: true });
    expect(storage.getItem(PRE_REPLACE_KEY)).toBe(raw);
    expect(readPreReplaceData(storage)).toEqual(original());
    expect(hasPreReplaceData(storage)).toBe(true);
    expect(JSON.parse(storage.getItem(LAST_GOOD_KEY)!)).toEqual(
      createEmptyData(),
    );
  });

  it("restores through the same validated replacement path and retains the replaced state for undo", () => {
    const before = original();
    const after = createEmptyData();
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(before) });
    writeStoredData(after, storage, { replaceCorrupt: true });
    const previous = readPreReplaceData(storage)!;
    const saved = commitStoredData(after, previous, storage, {
      replaceCorrupt: true,
    });
    expect(saved).toEqual(before);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(before);
    expect(readPreReplaceData(storage)).toEqual(after);
    expect(saved.version).toBe(before.version);
  });

  it("overwrites the single slot only on another full replacement", () => {
    const before = original();
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(before) });
    const next = createEmptyData();
    writeStoredData(next, storage, { replaceCorrupt: true });
    const edited = { ...next, profile: { ...next.profile, name: "Edited" } };
    writeStoredData(edited, storage);
    expect(readPreReplaceData(storage)).toEqual(before);
    writeStoredData(before, storage, { replaceCorrupt: true });
    expect(readPreReplaceData(storage)).toEqual(edited);
  });

  it("archives corrupt primary data without creating a replacement slot", () => {
    const storage = memory({ [STORAGE_KEY]: "{broken" });
    writeStoredData(original(), storage, { replaceCorrupt: true });
    expect(storage.getItem(CORRUPT_KEY)).toBe("{broken");
    expect(hasPreReplaceData(storage)).toBe(false);
    expect(readPreReplaceData(storage)).toBeNull();
  });

  it("does not create an empty-installation snapshot or block a replacement when the slot cannot be written", () => {
    const empty = memory();
    writeStoredData(original(), empty, { replaceCorrupt: true });
    expect(hasPreReplaceData(empty)).toBe(false);
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(original()) });
    writeStoredData(
      createEmptyData(),
      {
        ...storage,
        setItem(key: string, value: string) {
          if (key === PRE_REPLACE_KEY)
            throw new DOMException("Full", "QuotaExceededError");
          storage.setItem(key, value);
        },
      },
      { replaceCorrupt: true },
    );
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(
      createEmptyData(),
    );
  });

  it("rejects an invalid snapshot before it can overwrite valid current data", () => {
    const raw = JSON.stringify(original());
    const storage = memory({
      [STORAGE_KEY]: raw,
      [PRE_REPLACE_KEY]: "{bad snapshot",
    });
    expect(() => readPreReplaceData(storage)).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.attempts).toEqual([]);
    expect(
      hasPreReplaceData({
        getItem() {
          throw new Error("Blocked");
        },
        setItem() {},
      }),
    ).toBe(false);
  });
});
