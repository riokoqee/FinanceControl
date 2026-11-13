import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("explicit PWA activation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function setup(first = false) {
    const oldWorker = Object.assign(new EventTarget(), {
      state: "activated",
      postMessage: vi.fn(),
    });
    const nextWorker = Object.assign(new EventTarget(), {
      state: "installed",
      postMessage: vi.fn(),
    });
    const registration = Object.assign(new EventTarget(), {
      active: first ? null : oldWorker,
      waiting: nextWorker as typeof nextWorker | null,
      installing: null,
      update: vi.fn(async () => {}),
    });
    const container = Object.assign(new EventTarget(), {
      controller: first ? null : oldWorker,
      register: vi.fn(async () => registration),
    });
    const reload = vi.fn();
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubEnv("PROD", true);
    vi.stubEnv("BASE_URL", "/belilog/");
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("navigator", {
      serviceWorker: container,
      onLine: true,
      userAgent: "test",
      platform: "test",
    });
    vi.stubGlobal("document", { readyState: "complete" });
    vi.stubGlobal(
      "window",
      Object.assign(new EventTarget(), {
        isSecureContext: true,
        matchMedia: () => ({ matches: false }),
        location: { reload },
        requestIdleCallback: (callback: () => void) => {
          callback();
          return 1;
        },
      }),
    );
    const client = await import("./pwaClient");
    client.startPwa();
    await Promise.resolve();
    return { client, registration, container, nextWorker, reload, storage };
  }

  it("flushes before activation and reload, sends one message and reloads only once", async () => {
    const { client, registration, container, nextWorker, reload, storage } =
      await setup();
    const flush = vi.fn(() => true);
    expect(client.applyPwaUpdate(flush)).toBe(true);
    expect(client.applyPwaUpdate(flush)).toBe(false);
    expect(nextWorker.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: "SKIP_WAITING",
    });
    expect(flush).toHaveBeenCalledOnce();
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
    registration.active = nextWorker;
    registration.waiting = null;
    container.controller = nextWorker;
    container.dispatchEvent(new Event("controllerchange"));
    container.dispatchEvent(new Event("controllerchange"));
    expect(flush).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledOnce();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("does not activate or reload the first installation", async () => {
    const { client, container, nextWorker, reload } = await setup(true);
    const flush = vi.fn(() => true);
    expect(client.applyPwaUpdate(flush)).toBe(false);
    container.controller = nextWorker;
    container.dispatchEvent(new Event("controllerchange"));
    expect(flush).not.toHaveBeenCalled();
    expect(nextWorker.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("leaves an invalid or unsaved profile editable and permits a later retry", async () => {
    const { client, nextWorker } = await setup();
    expect(client.applyPwaUpdate(() => false)).toBe(false);
    expect(client.getPwaStatus().applyError).toBe("profile");
    expect(nextWorker.postMessage).not.toHaveBeenCalled();
    expect(client.applyPwaUpdate(() => true)).toBe(true);
  });

  it("checks the latest draft again after activation and can reload after it is corrected", async () => {
    const { client, registration, container, nextWorker, reload } =
      await setup();
    const flush = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(client.applyPwaUpdate(flush)).toBe(true);
    registration.active = nextWorker;
    registration.waiting = null;
    container.controller = nextWorker;
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
    expect(client.getPwaStatus().applyError).toBe("profile");
    expect(client.applyPwaUpdate(() => true)).toBe(true);
    expect(nextWorker.postMessage).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("removes the reload listener when messaging fails or the controller never changes", async () => {
    const { client, container, nextWorker, reload } = await setup();
    nextWorker.postMessage.mockImplementationOnce(() => {
      throw new Error("Worker closed");
    });
    expect(client.applyPwaUpdate(() => true)).toBe(false);
    expect(client.getPwaStatus().applyError).toBe("failed");
    expect(client.applyPwaUpdate(() => true)).toBe(true);
    vi.advanceTimersByTime(15_001);
    expect(client.getPwaStatus().applying).toBe(false);
    expect(client.getPwaStatus().applyError).toBe("failed");
    container.controller = nextWorker;
    container.dispatchEvent(new Event("controllerchange"));
    expect(reload).not.toHaveBeenCalled();
  });
});
