import type { Language } from "./finance";

/** Units of each currency per one US dollar; USD is the fixed base. */
export interface ExchangeRates {
  USD: 1;
  EUR: number;
  KZT: number;
}

/** A provider snapshot and its rates are saved atomically. Absence means manual. */
export interface ExchangeRateSync {
  mode: "manual" | "automatic";
  source?: "frankfurter";
  checkedAt?: string;
  dates?: { EUR: string; KZT: string };
}

function dataRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every(
      (key) =>
        typeof key === "string" &&
        "value" in Object.getOwnPropertyDescriptor(value, key)!,
    )
  );
}

export function isRateDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isExchangeRateSync(
  value: unknown,
  rates?: ExchangeRates,
): value is ExchangeRateSync {
  if (
    !dataRecord(value) ||
    !Reflect.ownKeys(value).every((key) =>
      ["mode", "source", "checkedAt", "dates"].includes(key as string),
    ) ||
    (value.mode !== "manual" && value.mode !== "automatic")
  )
    return false;
  const snapshot = ["source", "checkedAt", "dates"].some((key) =>
    Object.hasOwn(value, key),
  );
  if (!snapshot) return true;
  if (
    !rates ||
    value.mode !== "automatic" ||
    value.source !== "frankfurter" ||
    typeof value.checkedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.checkedAt)
  )
    return false;
  const checked = new Date(value.checkedAt);
  if (
    !Number.isFinite(checked.getTime()) ||
    checked.toISOString() !== value.checkedAt
  )
    return false;
  const dates = value.dates;
  return (
    dataRecord(dates) &&
    Object.keys(dates).length === 2 &&
    isRateDate(dates.EUR) &&
    isRateDate(dates.KZT) &&
    dates.EUR <= value.checkedAt.slice(0, 10) &&
    dates.KZT <= value.checkedAt.slice(0, 10)
  );
}

export const MIN_EXCHANGE_RATE = 0.000001;
export const MAX_EXCHANGE_RATE = 1_000_000;
export const EXCHANGE_RATE_DECIMALS = 6;

/** Illustrative estimates, retained for profiles without manually saved rates. */
export const REFERENCE_RATES: Readonly<ExchangeRates> = Object.freeze({
  USD: 1,
  EUR: 0.92,
  KZT: 480,
});

export const currencyCopy = {
  ru: {
    invalidRates:
      "Курсы валют некорректны. Укажите положительные значения от 0,000001 до 1 000 000, не более 6 знаков после запятой; базовый курс USD должен равняться 1.",
    manual: "Ваш курс",
    estimate: "Условный курс",
  },
  en: {
    invalidRates:
      "Exchange rates are invalid. Enter positive values from 0.000001 to 1,000,000, with at most 6 decimal places; the USD base rate must be 1.",
    manual: "Your rates",
    estimate: "Illustrative rate",
  },
} as const;

function isRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_EXCHANGE_RATE &&
    value <= MAX_EXCHANGE_RATE &&
    Number(value.toFixed(EXCHANGE_RATE_DECIMALS)) === value
  );
}

/** Accept only explicit currency data, never inherited values or accessors. */
export function isExchangeRates(value: unknown): value is ExchangeRates {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 3 ||
    !keys.every((key) => key === "USD" || key === "EUR" || key === "KZT")
  )
    return false;
  const usd = Object.getOwnPropertyDescriptor(value, "USD");
  const eur = Object.getOwnPropertyDescriptor(value, "EUR");
  const kzt = Object.getOwnPropertyDescriptor(value, "KZT");
  return (
    !!usd &&
    !!eur &&
    !!kzt &&
    "value" in usd &&
    "value" in eur &&
    "value" in kzt &&
    usd.value === 1 &&
    isRate(eur.value) &&
    isRate(kzt.value)
  );
}

/** Parse user input without exponents, grouping or silently discarded decimals. */
export function parseExchangeRate(input: string): number | null {
  const text = input.trim();
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(text)) return null;
  const value = Number(text.replace(",", "."));
  return isRate(value) ? value : null;
}

export function resolveExchangeRates(
  rates?: ExchangeRates,
): Readonly<ExchangeRates> {
  return rates ?? REFERENCE_RATES;
}

export function getRateSourceLabel(
  rates?: ExchangeRates,
  language: Language = "ru",
  sync?: ExchangeRateSync,
): string {
  return sync?.source === "frankfurter" && sync.dates
    ? "Frankfurter"
    : currencyCopy[language][rates ? "manual" : "estimate"];
}

/** Distinguishes user-supplied rates from fixed estimates; neither is a live feed. */
export function getRateLabel(
  rates?: ExchangeRates,
  language: Language = "ru",
  sync?: ExchangeRateSync,
): string {
  const source = resolveExchangeRates(rates);
  const formatter = new Intl.NumberFormat(
    language === "en" ? "en-US" : "ru-RU",
    {
      maximumFractionDigits: EXCHANGE_RATE_DECIMALS,
      useGrouping: false,
    },
  );
  const provider =
    sync?.source === "frankfurter" && sync.dates
      ? `Frankfurter · EUR ${sync.dates.EUR} · KZT ${sync.dates.KZT}`
      : getRateSourceLabel(rates, language, sync);
  return `${provider}: 1 USD = ${formatter.format(source.EUR)} EUR = ${formatter.format(source.KZT)} KZT`;
}
