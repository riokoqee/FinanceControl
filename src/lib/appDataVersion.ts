import type { AppData } from "./finance";

/** Format versions protect optional data from older open tabs and backups. */
export const APP_DATA_VERSIONS = {
  legacy: 1,
  planning: 2,
  streak: 3,
  manualRates: 4,
} as const;

export type AppDataVersion =
  (typeof APP_DATA_VERSIONS)[keyof typeof APP_DATA_VERSIONS];
export const CURRENT_APP_DATA_VERSION = APP_DATA_VERSIONS.manualRates;
const supportedVersions: readonly number[] = Object.values(APP_DATA_VERSIONS);

export function isSupportedAppDataVersion(
  value: unknown,
): value is AppDataVersion {
  return typeof value === "number" && supportedVersions.includes(value);
}

/** Legacy version-two copies stay version two even after their last feature is removed. */
export function getDataVersion(data: AppData): AppDataVersion {
  if (data.profile.exchangeRates !== undefined)
    return APP_DATA_VERSIONS.manualRates;
  if (data.streak !== undefined) return APP_DATA_VERSIONS.streak;
  if (
    data.version === APP_DATA_VERSIONS.planning ||
    data.categoryBudgets !== undefined ||
    data.shoppingTemplates !== undefined
  )
    return APP_DATA_VERSIONS.planning;
  return APP_DATA_VERSIONS.legacy;
}

/** Choose the feature-bearing format without changing or eagerly migrating data. */
export function withCanonicalVersion(data: AppData): AppData {
  const version = getDataVersion(data);
  return data.version === version ? data : { ...data, version };
}
