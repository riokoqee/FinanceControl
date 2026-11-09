/** Use a stable event ID across retries; UUIDs also avoid collisions between tabs. */
export function createRecordId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
