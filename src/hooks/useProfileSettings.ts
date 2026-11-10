import { LocalizedError, localizeError } from "../lib/localizedError";
import { message } from "../lib/messages";
import { useEffect } from "react";
import type { CategoryBudget, Currency, ExchangeRates } from "../lib/finance";
import { MAX_AMOUNT, convertAmount } from "../lib/finance";
import {
  mergeCategoryBudgetsDraft,
  mergeProfileDraft,
} from "../lib/storage/storage";
import { settingsCopy } from "../lib/settingsCopy";
import { useProfileDraft } from "./useProfileDraft";
import type { AppDataController } from "./useAppData";
import type { DialogController } from "./useDialogState";
import type { AppFeedback } from "./useAppFeedback";
import type { Page } from "./appTypes";

export function useProfileSettings(
  store: AppDataController,
  page: Page,
  dialogs: DialogController,
  feedback: AppFeedback,
) {
  const { data, setData } = store;
  const language = data.profile.language;
  const draft = useProfileDraft(
    data.profile,
    page === "profile",
    (base, value) => {
      const saved = setData((current) => ({
        ...current,
        profile: mergeProfileDraft(base, current.profile, value),
      }));
      return saved?.profile ?? null;
    },
  );
  const { profile, commitProfileFields } = draft;
  function updateCurrency(next: Currency) {
    try {
      const monthlyBudget =
        Math.round(
          convertAmount(
            profile.monthlyBudget,
            profile.currency,
            next,
            data.profile.exchangeRates,
          ) * 100,
        ) / 100;
      if (!Number.isFinite(monthlyBudget) || monthlyBudget > MAX_AMOUNT)
        throw new LocalizedError(
          "ui.theConvertedBudgetExceedsTheLimitReduceYourBudgetBeforeChangingCurrency",
        );
      commitProfileFields({ currency: next, monthlyBudget });
    } catch (cause) {
      feedback.setToast({
        message: localizeError(language, cause, "error.saveFailed"),
        error: true,
      });
    }
  }
  function saveExchangeRates(
    base: ExchangeRates | undefined,
    next: ExchangeRates,
  ): boolean {
    const saved = setData((current) => {
      const { exchangeRates: _rates, ...originalProfile } = current.profile;
      return {
        ...current,
        profile: mergeProfileDraft(
          { ...originalProfile, ...(base ? { exchangeRates: base } : {}) },
          current.profile,
          { ...current.profile, exchangeRates: next },
        ),
      };
    });
    if (saved)
      feedback.setToast({ message: settingsCopy[language].ratesSaved });
    return Boolean(saved);
  }
  function saveCategoryBudgets(
    base: CategoryBudget[],
    next: CategoryBudget[],
  ): boolean {
    if (
      !setData((current) => ({
        ...current,
        categoryBudgets: mergeCategoryBudgetsDraft(
          base,
          current.categoryBudgets ?? [],
          next,
        ),
      }))
    )
      return false;
    feedback.setToast({ message: message(language, "ui.limitsSaved") });
    return true;
  }
  function saveAvatar(avatar: string) {
    if (!commitProfileFields({ avatar })) return;
    dialogs.close();
    feedback.setToast({ message: message(language, "ui.avatarSaved") });
  }
  function toggleTheme() {
    commitProfileFields({
      theme:
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    });
  }
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        data.profile.theme === "dark" ||
        (data.profile.theme === "system" && media.matches)
          ? "dark"
          : "light";
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          "content",
          getComputedStyle(document.documentElement)
            .getPropertyValue("--bg")
            .trim(),
        );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data.profile.theme]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const initials = data.profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
  return {
    ...draft,
    initials,
    updateCurrency,
    saveExchangeRates,
    saveCategoryBudgets,
    saveAvatar,
    toggleTheme,
  };
}
export type ProfileSettings = ReturnType<typeof useProfileSettings>;
