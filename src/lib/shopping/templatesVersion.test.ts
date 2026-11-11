import { describe, expect, it } from "vitest";
import { createEmptyData, validateBackup } from "../finance";
import type { AppData } from "../finance";
import { APP_DATA_VERSIONS } from "../appDataVersion";
import { STREAK_LEDGER_VERSION } from "../streak/streakTypes";
import { applyShoppingTemplate } from "./templates";

const ledger: AppData["streak"] = {
  version: STREAK_LEDGER_VERSION,
  startedOn: "2026-11-10",
  confirmedDays: [{ date: "2026-11-10", status: "NO_SPEND" }],
};

describe("shopping template data compatibility", () => {
  it.each([
    { version: APP_DATA_VERSIONS.streak, rates: false, sync: false },
    { version: APP_DATA_VERSIONS.manualRates, rates: true, sync: false },
    { version: APP_DATA_VERSIONS.automaticRates, rates: true, sync: true },
  ])(
    "preserves format $version and daily facts while applying a new plan",
    ({ version, rates, sync }) => {
      const empty = createEmptyData();
      const data: AppData = {
        ...empty,
        version,
        streak: ledger,
        profile: {
          ...empty.profile,
          ...(rates
            ? { exchangeRates: { USD: 1, EUR: 0.5, KZT: 500 } as const }
            : {}),
          ...(sync ? { exchangeRateSync: { mode: "automatic" as const } } : {}),
        },
        shoppingTemplates: [
          {
            id: "weekly",
            name: "Weekly groceries",
            items: [{ title: "Bread", currency: "EUR" }],
          },
        ],
      };
      const before = structuredClone(data);
      const applied = applyShoppingTemplate(data, "weekly");
      expect(applied.version).toBe(version);
      expect(applied.streak).toBe(ledger);
      expect(applied.profile).toBe(data.profile);
      expect(applied.transactions).toBe(data.transactions);
      expect(
        applied.shoppingList?.map(({ title, currency, transactionId }) => ({
          title,
          currency,
          transactionId,
        })),
      ).toEqual([
        { title: "Bread", currency: "EUR", transactionId: undefined },
      ]);
      expect(validateBackup(applied)).toEqual(applied);
      expect(applyShoppingTemplate(applied, "weekly")).toBe(applied);
      expect(data).toEqual(before);
    },
  );
});
