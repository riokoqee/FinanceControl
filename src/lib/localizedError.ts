import type { Language } from "./finance";
import { message } from "./messages";
import type { MessageKey, MessageValues } from "./messages";

/** Domain failures carry a stable code; the default message stays useful in logs. */
export class LocalizedError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly values: MessageValues = {},
  ) {
    super(message("ru", key, values));
    this.name = "LocalizedError";
  }
}

export function localizeError(
  language: Language,
  cause: unknown,
  fallback: MessageKey,
): string {
  return cause instanceof LocalizedError
    ? message(language, cause.key, cause.values)
    : message(language, fallback);
}
