import {
  EXCHANGE_RATE_DECIMALS,
  isExchangeRates,
  isRateDate,
} from "./currency";
import type { ExchangeRates, ExchangeRateSync } from "./currency";

export const EXCHANGE_RATE_URL =
  "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,KZT";
export const RATE_FETCH_TIMEOUT = 10_000;
export const RATE_RETRY_DELAY = 60_000;
const MAX_RESPONSE_SIZE = 16_384;

export type RateFeedErrorCode =
  | "offline"
  | "timeout"
  | "invalid"
  | "network"
  | "storage"
  | "conflict";
export class RateFeedError extends Error {
  constructor(readonly code: RateFeedErrorCode) {
    super(code);
    this.name = "RateFeedError";
  }
}

export interface RateSnapshot {
  rates: ExchangeRates;
  sync: ExchangeRateSync;
}

/** Only a complete pair set is accepted; neither response order nor one shared date is assumed. */
export function parseRateFeed(
  input: unknown,
  checkedAt = new Date(),
): RateSnapshot {
  if (!Array.isArray(input) || input.length !== 2)
    throw new RateFeedError("invalid");
  const rates: ExchangeRates = { USD: 1, EUR: 0, KZT: 0 };
  const dates = { EUR: "", KZT: "" };
  const checked = checkedAt.toISOString();
  const seen = new Set<string>();
  for (const row of input) {
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      row.base !== "USD" ||
      (row.quote !== "EUR" && row.quote !== "KZT") ||
      seen.has(row.quote) ||
      !isRateDate(row.date) ||
      row.date > checked.slice(0, 10) ||
      typeof row.rate !== "number" ||
      !Number.isFinite(row.rate) ||
      row.rate <= 0
    )
      throw new RateFeedError("invalid");
    const quote = row.quote as "EUR" | "KZT";
    rates[quote] = Number(row.rate.toFixed(EXCHANGE_RATE_DECIMALS));
    dates[quote] = row.date;
    seen.add(quote);
  }
  if (!isExchangeRates(rates)) throw new RateFeedError("invalid");
  return {
    rates,
    sync: {
      mode: "automatic",
      source: "frankfurter",
      checkedAt: checked,
      dates,
    },
  };
}

/** No credentials, IDs, finances or profile fields leave the browser. */
export async function fetchExchangeRates(
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RateSnapshot> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RATE_FETCH_TIMEOUT);
  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetcher(EXCHANGE_RATE_URL, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new RateFeedError("network");
    const text = await response.text();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (text.length > MAX_RESPONSE_SIZE) throw new RateFeedError("invalid");
    let input: unknown;
    try {
      input = JSON.parse(text) as unknown;
    } catch {
      throw new RateFeedError("invalid");
    }
    return parseRateFeed(input);
  } catch (cause) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (timedOut) throw new RateFeedError("timeout");
    throw cause instanceof RateFeedError ? cause : new RateFeedError("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function shouldRefreshRates(
  sync: ExchangeRateSync | undefined,
  now = new Date(),
): boolean {
  return (
    sync?.mode === "automatic" &&
    (!sync.checkedAt || localDay(new Date(sync.checkedAt)) !== localDay(now))
  );
}
