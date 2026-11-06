import type { Language } from "./finance";

export function plural(
  n: number,
  one: string,
  few: string,
  many: string,
  language: Language = "ru",
) {
  if (language === "en") return Math.abs(n) === 1 ? one : many;
  const v = Math.abs(n) % 100;
  return v >= 11 && v <= 19
    ? many
    : v % 10 === 1
      ? one
      : v % 10 >= 2 && v % 10 <= 4
        ? few
        : many;
}
