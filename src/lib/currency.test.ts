import { describe, expect, it } from "vitest";
import {
  EXCHANGE_RATE_DECIMALS,
  MAX_EXCHANGE_RATE,
  MIN_EXCHANGE_RATE,
  REFERENCE_RATES,
  getRateLabel,
  getRateSourceLabel,
  isExchangeRates,
  isExchangeRateSync,
  parseExchangeRate,
  resolveExchangeRates,
} from "./currency";

describe("manual exchange rates", () => {
  it("retains immutable illustrative defaults for profiles without saved rates", () => {
    expect(REFERENCE_RATES).toEqual({ USD: 1, EUR: 0.92, KZT: 480 });
    expect(Object.isFrozen(REFERENCE_RATES)).toBe(true);
    expect(resolveExchangeRates()).toBe(REFERENCE_RATES);
    const manual = { USD: 1 as const, EUR: 0.95, KZT: 510 };
    expect(resolveExchangeRates(manual)).toBe(manual);
  });

  it.each([
    ["0.92", 0.92],
    ["0,92", 0.92],
    [" 510,123456 ", 510.123456],
    ["1", 1],
    ["0.000001", MIN_EXCHANGE_RATE],
    ["1000000", MAX_EXCHANGE_RATE],
    ["999999.999999", 999999.999999],
  ])(
    "parses an explicit rate %s without monetary rounding",
    (input, expected) => {
      expect(parseExchangeRate(input)).toBe(expected);
    },
  );

  it.each([
    "",
    " ",
    "0",
    "-1",
    "+1",
    "0.0000001",
    "1000000.000001",
    "1.2345678",
    "1e2",
    "0x10",
    "Infinity",
    "NaN",
    "1 000",
    "1,000.25",
    ".92",
    "0.",
    "1,",
    "1\n2",
  ])("rejects malformed, out-of-range or over-precision input %s", (input) => {
    expect(parseExchangeRate(input)).toBeNull();
  });

  it("accepts exactly three explicit currencies, including a null-prototype data object", () => {
    expect(
      isExchangeRates({
        USD: 1,
        EUR: MIN_EXCHANGE_RATE,
        KZT: MAX_EXCHANGE_RATE,
      }),
    ).toBe(true);
    expect(
      isExchangeRates(
        Object.assign(Object.create(null), { USD: 1, EUR: 0.92, KZT: 480 }),
      ),
    ).toBe(true);
    expect(EXCHANGE_RATE_DECIMALS).toBe(6);
  });

  it.each(
    [
      null,
      undefined,
      [],
      {},
      { USD: 1, EUR: 0.92 },
      { USD: 2, EUR: 0.92, KZT: 480 },
      { USD: "1", EUR: 0.92, KZT: 480 },
      { USD: 1, EUR: "0.92", KZT: 480 },
      { USD: 1, EUR: 0, KZT: 480 },
      { USD: 1, EUR: -1, KZT: 480 },
      { USD: 1, EUR: Number.NaN, KZT: 480 },
      { USD: 1, EUR: 0.92, KZT: Infinity },
      { USD: 1, EUR: 0.0000001, KZT: 480 },
      { USD: 1, EUR: 0.92, KZT: 1000000.000001 },
      { USD: 1, EUR: 0.9200001, KZT: 480 },
      { USD: 1, EUR: 0.92, KZT: 480, JPY: 150 },
      { USD: 1, EUR: 0.92, KZT: 480, constructor: {} },
    ].map((value) => [value] as [unknown]),
  )("rejects invalid rate data %#", (value) => {
    expect(isExchangeRates(value)).toBe(false);
  });

  it("rejects prototype, non-enumerable and symbol extensions without reading getters", () => {
    const inherited = Object.create({ USD: 1, EUR: 0.92, KZT: 480 });
    expect(isExchangeRates(inherited)).toBe(false);
    expect(
      isExchangeRates(
        Object.assign(Object.create({ injected: true }), {
          USD: 1,
          EUR: 0.92,
          KZT: 480,
        }),
      ),
    ).toBe(false);
    expect(
      isExchangeRates(
        JSON.parse(
          '{"USD":1,"EUR":0.92,"KZT":480,"__proto__":{"polluted":true}}',
        ),
      ),
    ).toBe(false);
    const hidden = { USD: 1, EUR: 0.92, KZT: 480 };
    Object.defineProperty(hidden, "hidden", { value: true });
    expect(isExchangeRates(hidden)).toBe(false);
    expect(
      isExchangeRates({ USD: 1, EUR: 0.92, KZT: 480, [Symbol("extra")]: true }),
    ).toBe(false);
    let calls = 0;
    const accessor = {
      USD: 1,
      get EUR() {
        calls += 1;
        return 0.92;
      },
      KZT: 480,
    };
    expect(isExchangeRates(accessor)).toBe(false);
    expect(calls).toBe(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("labels saved rates separately from illustrative values in both languages", () => {
    expect(getRateLabel()).toBe("Условный курс: 1 USD = 0,92 EUR = 480 KZT");
    expect(getRateLabel(undefined, "en")).toBe(
      "Illustrative rate: 1 USD = 0.92 EUR = 480 KZT",
    );
    const rates = { USD: 1 as const, EUR: 0.987654, KZT: 512.123456 };
    expect(getRateLabel(rates, "ru")).toBe(
      "Ваш курс: 1 USD = 0,987654 EUR = 512,123456 KZT",
    );
    expect(getRateLabel(rates, "en")).toBe(
      "Your rates: 1 USD = 0.987654 EUR = 512.123456 KZT",
    );
    expect(getRateLabel({ ...REFERENCE_RATES }, "en")).toContain("Your rates");
  });
});

describe("saved automatic rate provenance", () => {
  const rates = { USD: 1 as const, EUR: 0.9, KZT: 450 };
  const sync = {
    mode: "automatic" as const,
    source: "frankfurter" as const,
    checkedAt: "2026-11-11T12:00:00.000Z",
    dates: { EUR: "2026-11-10", KZT: "2026-11-09" },
  };

  it("allows opt-in before a first fetch and explicit manual mode without a snapshot", () => {
    expect(isExchangeRateSync({ mode: "automatic" })).toBe(true);
    expect(isExchangeRateSync({ mode: "manual" })).toBe(true);
    expect(isExchangeRateSync(sync, rates)).toBe(true);
  });

  it.each(
    [
      undefined,
      null,
      [],
      {},
      { mode: "auto" },
      { mode: "manual", source: "frankfurter" },
      { ...sync, checkedAt: undefined },
      { ...sync, checkedAt: "2026-11-11" },
      { ...sync, checkedAt: "2026-02-30T12:00:00.000Z" },
      { ...sync, source: "other" },
      { ...sync, dates: { EUR: "2026-11-10" } },
      { ...sync, dates: { EUR: "2026-11-12", KZT: "2026-11-09" } },
      { ...sync, dates: { EUR: "2026-02-30", KZT: "2026-11-09" } },
      { ...sync, unexpected: true },
    ].map((value) => [value] as [unknown]),
  )("rejects incomplete or mismatched metadata %#", (value) => {
    expect(isExchangeRateSync(value, rates)).toBe(false);
  });

  it("requires rates for provenance, rejects inherited fields and does not run accessors", () => {
    expect(isExchangeRateSync(sync)).toBe(false);
    expect(isExchangeRateSync(Object.create(sync), rates)).toBe(false);
    let calls = 0;
    expect(
      isExchangeRateSync(
        {
          get mode() {
            calls++;
            return "automatic";
          },
        },
        rates,
      ),
    ).toBe(false);
    expect(calls).toBe(0);
    const hidden = { ...sync };
    Object.defineProperty(hidden, "hidden", { value: 1 });
    expect(isExchangeRateSync(hidden, rates)).toBe(false);
  });

  it("uses the actual source dates and keeps manual labels compatible", () => {
    expect(getRateSourceLabel(rates, "en", sync)).toBe("Frankfurter");
    expect(getRateLabel(rates, "en", sync)).toBe(
      "Frankfurter · EUR 2026-11-10 · KZT 2026-11-09: 1 USD = 0.9 EUR = 450 KZT",
    );
    expect(getRateSourceLabel(rates, "ru", { mode: "automatic" })).toBe(
      "Ваш курс",
    );
    expect(getRateSourceLabel(undefined, "en", { mode: "automatic" })).toBe(
      "Illustrative rate",
    );
  });
});
