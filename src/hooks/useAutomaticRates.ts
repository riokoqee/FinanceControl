import { useCallback, useEffect, useRef, useState } from "react";
import type { ExchangeRateSync, Profile } from "../lib/finance";
import { STORAGE_KEY } from "../lib/finance";
import {
  fetchExchangeRates,
  RateFeedError,
  RATE_RETRY_DELAY,
  shouldRefreshRates,
} from "../lib/exchangeRateFeed";
import type { RateFeedErrorCode } from "../lib/exchangeRateFeed";
import type { AppDataController } from "./useAppData";
import { useLocalCalendarDay } from "./useStreakStats";

function snapshot(profile: Profile): string {
  return JSON.stringify([profile.exchangeRates, profile.exchangeRateSync]);
}

/** Network access starts only after a persisted, explicit automatic-mode choice. */
export function useAutomaticRates(store: AppDataController) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<RateFeedErrorCode | null>(null);
  const localDay = useLocalCalendarDay();
  const request = useRef<AbortController | null>(null);
  const latest = useRef(store);
  latest.current = store;
  const retryAfter = useRef(0);
  const mounted = useRef(true);
  const signature = snapshot(store.data.profile);
  const cancel = useCallback(() => {
    request.current?.abort();
    request.current = null;
    if (mounted.current) setLoading(false);
  }, []);

  const refresh = useCallback(async (explicit = true): Promise<void> => {
    const active = latest.current;
    const baseline = active.current.current.profile;
    if (
      baseline.exchangeRateSync?.mode !== "automatic" ||
      request.current ||
      !["ready", "empty"].includes(active.status)
    )
      return;
    if (navigator.onLine)
      setError((current) => (current === "offline" ? null : current));
    if (
      !explicit &&
      (!shouldRefreshRates(baseline.exchangeRateSync) ||
        Date.now() < retryAfter.current ||
        document.visibilityState !== "visible")
    )
      return;
    if (!navigator.onLine) {
      setError("offline");
      return;
    }
    const baseSnapshot = snapshot(baseline);
    const epoch = active.replacementEpoch.current;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchExchangeRates(controller.signal);
      if (controller.signal.aborted || !mounted.current) return;
      if (
        baseline.exchangeRateSync?.dates &&
        fetched.sync.dates &&
        (fetched.sync.dates.EUR < baseline.exchangeRateSync.dates.EUR ||
          fetched.sync.dates.KZT < baseline.exchangeRateSync.dates.KZT)
      )
        throw new RateFeedError("invalid");
      const current = latest.current;
      if (
        current.replacementEpoch.current !== epoch ||
        snapshot(current.current.current.profile) !== baseSnapshot
      )
        return;
      const saved = current.operateData((data) => {
        // commitOperation reads storage again, closing the race with another tab.
        if (
          snapshot(data.profile) !== baseSnapshot ||
          current.replacementEpoch.current !== epoch
        )
          return { data, result: false };
        return {
          data: {
            ...data,
            profile: {
              ...data.profile,
              exchangeRates: fetched.rates,
              exchangeRateSync: fetched.sync,
            },
          },
          result: true,
        };
      });
      if (!saved) setError("storage");
      else if (!saved.result) setError("conflict");
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) {
        retryAfter.current = Date.now() + RATE_RETRY_DELAY;
        setError(cause instanceof RateFeedError ? cause.code : "network");
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (mounted.current) setLoading(false);
      }
    }
  }, []);

  const setMode = useCallback(
    (mode: ExchangeRateSync["mode"]): boolean => {
      cancel();
      setError(null);
      retryAfter.current = 0;
      const current = latest.current;
      if (
        (current.current.current.profile.exchangeRateSync?.mode ?? "manual") ===
        mode
      )
        return true;
      return !!current.mutateData((data) => ({
        ...data,
        profile: { ...data.profile, exchangeRateSync: { mode } },
      }));
    },
    [cancel],
  );

  useEffect(() => {
    mounted.current = true;
    const foreground = () => {
      void refresh(false);
    };
    const offline = () => {
      cancel();
      setError(
        latest.current.current.current.profile.exchangeRateSync?.mode ===
          "automatic"
          ? "offline"
          : null,
      );
    };
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY) cancel();
    };
    window.addEventListener("online", foreground);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", foreground);
    window.addEventListener("storage", changed);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      mounted.current = false;
      cancel();
      window.removeEventListener("online", foreground);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", foreground);
      window.removeEventListener("storage", changed);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [cancel, refresh]);
  useEffect(() => {
    cancel();
    setError(null);
    void refresh(false);
    return cancel;
  }, [
    signature,
    store.replacementEpoch.current,
    store.status,
    localDay,
    cancel,
    refresh,
  ]);

  return { loading, error, refresh, setMode };
}

export type AutomaticRatesController = ReturnType<typeof useAutomaticRates>;
