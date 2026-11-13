import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyData } from "../lib/finance";
import * as feed from "../lib/exchangeRateFeed";
import type { AppDataController } from "./useAppData";
import { useAutomaticRates } from "./useAutomaticRates";

const state = vi.hoisted(() => ({ error: vi.fn(), loading: vi.fn() }));
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (value: unknown) => [
    value,
    value === null ? state.error : state.loading,
  ],
}));
vi.mock("./useStreakStats", () => ({
  useLocalCalendarDay: () => "2026-11-13",
}));

describe("automatic-rate commit failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("document", { visibilityState: "visible" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(["storage", "conflict", "success", "network"] as const)(
    "distinguishes %s without changing a previously saved snapshot",
    async (outcome) => {
      const data = createEmptyData();
      data.profile.exchangeRateSync = { mode: "automatic" };
      const before = structuredClone(data);
      const operateData = vi.fn(() =>
        outcome === "storage" ? null : { data, result: outcome === "success" },
      );
      const store = {
        data,
        current: { current: data },
        status: "ready",
        replacementEpoch: { current: 0 },
        operateData,
      } as unknown as AppDataController;
      const fetch = vi.spyOn(feed, "fetchExchangeRates");
      if (outcome === "network")
        fetch.mockRejectedValue(new feed.RateFeedError("network"));
      else
        fetch.mockResolvedValue({
          rates: { USD: 1, EUR: 0.9, KZT: 450 },
          sync: { mode: "automatic" },
        });
      await useAutomaticRates(store).refresh();
      if (outcome === "success") {
        expect(state.error).not.toHaveBeenCalledWith("storage");
        expect(state.error).not.toHaveBeenCalledWith("conflict");
      } else expect(state.error).toHaveBeenLastCalledWith(outcome);
      expect(data).toEqual(before);
      expect(operateData).toHaveBeenCalledTimes(outcome === "network" ? 0 : 1);
    },
  );
});
