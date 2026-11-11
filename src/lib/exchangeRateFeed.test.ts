import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXCHANGE_RATE_URL,
  fetchExchangeRates,
  parseRateFeed,
  RateFeedError,
  RATE_FETCH_TIMEOUT,
  shouldRefreshRates,
} from "./exchangeRateFeed";

const checked = new Date("2026-11-11T12:00:00.000Z");
const rows = () => [
  { base: "USD", quote: "EUR", date: "2026-11-10", rate: 0.892123456 },
  { base: "USD", quote: "KZT", date: "2026-11-09", rate: 448.51234567 },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(checked);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Frankfurter reference rate feed", () => {
  it("requires complete distinct quotes, preserves their separate source dates and rounds conversion precision", () => {
    const snapshot = parseRateFeed(rows().reverse(), checked);
    expect(snapshot).toEqual({
      rates: { USD: 1, EUR: 0.892123, KZT: 448.512346 },
      sync: {
        mode: "automatic",
        source: "frankfurter",
        checkedAt: checked.toISOString(),
        dates: { EUR: "2026-11-10", KZT: "2026-11-09" },
      },
    });
  });

  it.each(
    [
      null,
      {},
      [],
      [rows()[0]],
      [...rows(), rows()[0]],
      [rows()[0], rows()[0]],
      [{ ...rows()[0], base: "EUR" }, rows()[1]],
      [{ ...rows()[0], quote: "JPY" }, rows()[1]],
      [{ ...rows()[0], date: "2026-02-30" }, rows()[1]],
      [{ ...rows()[0], date: "2026-11-12" }, rows()[1]],
      [{ ...rows()[0], rate: "0.9" }, rows()[1]],
      [{ ...rows()[0], rate: 0 }, rows()[1]],
      [{ ...rows()[0], rate: -1 }, rows()[1]],
      [{ ...rows()[0], rate: Infinity }, rows()[1]],
      [{ ...rows()[0], rate: 1e9 }, rows()[1]],
      [{ ...rows()[0], rate: 1e-9 }, rows()[1]],
    ].map((input) => [input] as [unknown]),
  )("rejects incomplete, malformed, future or unusable quotes %#", (input) => {
    expect(() => parseRateFeed(input, checked)).toThrow(RateFeedError);
  });

  it("requests only the fixed anonymous currency endpoint with no cookies or referrer", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(rows())),
    );
    await fetchExchangeRates(undefined, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(EXCHANGE_RATE_URL);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    });
  });

  it.each([
    [new Response("{}", { status: 503 }), "network"],
    [new Response("<html>Bad gateway</html>"), "invalid"],
    [new Response("x".repeat(20_000)), "invalid"],
    [new Response(JSON.stringify([rows()[0]])), "invalid"],
  ])(
    "rejects HTTP failures or malformed response bodies %#",
    async (response, code) => {
      await expect(
        fetchExchangeRates(
          undefined,
          vi.fn(async () => response),
        ),
      ).rejects.toMatchObject({ code });
    },
  );

  it("times out stalled network requests and reports cancellation separately", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const timed = fetchExchangeRates(undefined, fetcher);
    const assertion = expect(timed).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(RATE_FETCH_TIMEOUT);
    await assertion;
    const controller = new AbortController();
    const cancelled = fetchExchangeRates(controller.signal, fetcher);
    controller.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a request when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      fetchExchangeRates(controller.signal, fetcher),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never schedules the manual default and refreshes automatic settings only after the local day changes", () => {
    expect(shouldRefreshRates(undefined, checked)).toBe(false);
    expect(shouldRefreshRates({ mode: "manual" }, checked)).toBe(false);
    expect(shouldRefreshRates({ mode: "automatic" }, checked)).toBe(true);
    const sync = parseRateFeed(rows(), checked).sync;
    expect(shouldRefreshRates(sync, new Date(checked.getTime() + 60_000))).toBe(
      false,
    );
    expect(
      shouldRefreshRates(sync, new Date(checked.getTime() + 86_400_000)),
    ).toBe(true);
  });
});
