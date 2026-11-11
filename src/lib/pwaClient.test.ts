import { describe, expect, it } from "vitest";
import { isPwaUpdateWaiting } from "./pwaClient";

describe("first install versus a waiting PWA update", () => {
  const initialWorker = {} as ServiceWorker;
  const nextWorker = {} as ServiceWorker;
  it("does not advertise an update while the first installed worker briefly waits", () => {
    expect(isPwaUpdateWaiting({ active: null, waiting: initialWorker })).toBe(
      false,
    );
  });
  it("does not advertise an update for the active worker itself", () => {
    expect(
      isPwaUpdateWaiting({ active: initialWorker, waiting: initialWorker }),
    ).toBe(false);
    expect(isPwaUpdateWaiting({ active: initialWorker, waiting: null })).toBe(
      false,
    );
  });
  it("advertises an update only while a different worker waits behind the active release", () => {
    expect(
      isPwaUpdateWaiting({ active: initialWorker, waiting: nextWorker }),
    ).toBe(true);
  });
});
