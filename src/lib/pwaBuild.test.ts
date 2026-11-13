import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { appManifest, appWorker, releaseRevision } from "../../build/pwa";

const origin = "https://captain.github.io";
function runtime({
  base = "/belilog/",
  revision = "new",
  active = false,
  fail = false,
  vary = false,
} = {}) {
  const stores = new Map<string, Map<string, Response>>();
  const handlers = new Map<string, (event: unknown) => void>();
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  const network = vi.fn(async () => new Response("network"));
  const added: Request[][] = [];
  const caches = {
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async addAll(requests: Request[]) {
          added.push(requests);
          for (const request of requests)
            store.set(request.url, new Response(`cached:${request.url}`));
          if (fail) throw new Error("Incomplete release");
        },
        async put(url: string, response: Response) {
          store.set(url, response);
        },
        async match(
          request: Request | string,
          options?: { ignoreVary?: boolean },
        ) {
          // Static preview servers vary responses on Origin; module requests and precache GETs differ.
          if (vary && typeof request !== "string" && !options?.ignoreVary)
            return undefined;
          return store
            .get(typeof request === "string" ? request : request.url)
            ?.clone();
        },
      };
    },
  };
  runInNewContext(
    appWorker(base, revision, [
      "index.html",
      "assets/tracker-abc.js",
      "fonts/report-font.ttf",
    ]),
    {
      URL,
      Request,
      Response,
      Set,
      Promise,
      caches,
      fetch: network,
      self: {
        location: { origin },
        registration: { active: active ? {} : null },
        clients: { claim },
        skipWaiting,
        addEventListener(name: string, handler: (event: unknown) => void) {
          handlers.set(name, handler);
        },
      },
    },
  );
  async function lifecycle(name: string) {
    let pending: Promise<void> | undefined;
    handlers.get(name)!({
      waitUntil(value: Promise<void>) {
        pending = value;
      },
    });
    await pending;
  }
  async function request(url: string, mode = "cors", method = "GET") {
    let pending: Promise<Response> | undefined;
    handlers.get("fetch")!({
      request: { url, mode, method },
      respondWith(value: Promise<Response>) {
        pending = value;
      },
    });
    return pending ? (await pending).text() : undefined;
  }
  async function message(data: unknown) {
    let pending: Promise<void> | undefined;
    handlers.get("message")!({
      data,
      waitUntil(value: Promise<void>) {
        pending = value;
      },
    });
    await pending;
  }
  return {
    stores,
    caches,
    added,
    claim,
    skipWaiting,
    network,
    lifecycle,
    request,
    message,
  };
}

describe("installable BeliLog manifest", () => {
  it.each(["/", "/belilog/"])(
    "keeps id, launch URL, icons and scope within %s",
    (base) => {
      const manifest = appManifest(base);
      expect(manifest.id).toBe(base);
      expect(manifest.scope).toBe(base);
      expect(manifest.start_url).toBe(base);
      expect(manifest.display).toBe("standalone");
      expect(manifest.icons.map((icon) => [icon.sizes, icon.src])).toEqual([
        ["192x192", `${base}belilog-icon-192.png`],
        ["512x512", `${base}belilog-icon-512.png`],
      ]);
    },
  );
});

describe("atomic, scoped offline app releases", () => {
  it("accepts SKIP_WAITING only for an explicit update and retains old lazy chunks for other tabs", async () => {
    const worker = runtime({ active: true });
    const oldName = "belilog-pwa:%2Fbelilog%2F:old";
    worker.stores.set(
      oldName,
      new Map([
        [`${origin}/belilog/assets/old-page.js`, new Response("old page")],
      ]),
    );
    await worker.lifecycle("install");
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    await worker.message({ type: "OTHER" });
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    await worker.message({ type: "SKIP_WAITING" });
    expect(worker.skipWaiting).toHaveBeenCalledOnce();
    await worker.lifecycle("activate");
    expect(worker.stores.has(oldName)).toBe(true);
    expect(await worker.request(`${origin}/belilog/assets/old-page.js`)).toBe(
      "old page",
    );
    expect(worker.claim).not.toHaveBeenCalled();
    expect(worker.network).not.toHaveBeenCalled();
  });
  it("keeps the original first-install claim behavior even if it receives an update message", async () => {
    const worker = runtime();
    await worker.lifecycle("install");
    await worker.message({ type: "SKIP_WAITING" });
    expect(worker.skipWaiting).not.toHaveBeenCalled();
    await worker.lifecycle("activate");
    expect(worker.claim).toHaveBeenCalledOnce();
  });
  it("precaches lazy modules and the PDF font, bypassing HTTP cache", async () => {
    const worker = runtime();
    await worker.lifecycle("install");
    expect(worker.added[0].map((request) => request.url)).toEqual([
      `${origin}/belilog/index.html`,
      `${origin}/belilog/assets/tracker-abc.js`,
      `${origin}/belilog/fonts/report-font.ttf`,
    ]);
    expect(
      worker.added[0].every(
        (request) =>
          request.cache === "reload" && request.credentials === "same-origin",
      ),
    ).toBe(true);
    expect(worker.claim).not.toHaveBeenCalled();
  });
  it("claims only after the first successful cache activates", async () => {
    const worker = runtime();
    await worker.lifecycle("install");
    await worker.lifecycle("activate");
    expect(worker.claim).toHaveBeenCalledOnce();
  });
  it("does not claim existing pages when upgrading an active worker, even if its cache was evicted", async () => {
    const worker = runtime({ active: true });
    await worker.lifecycle("install");
    await worker.lifecycle("activate");
    expect(worker.claim).not.toHaveBeenCalled();
  });
  it("keeps the old complete release when a new install fails", async () => {
    const worker = runtime({ active: true, fail: true });
    worker.stores.set("belilog-pwa:%2Fbelilog%2F:old", new Map());
    await expect(worker.lifecycle("install")).rejects.toThrow(
      "Incomplete release",
    );
    expect([...worker.stores.keys()]).toEqual([
      "belilog-pwa:%2Fbelilog%2F:old",
    ]);
    expect(worker.claim).not.toHaveBeenCalled();
  });
  it("retains old chunks while the new release is only waiting", async () => {
    const worker = runtime({ active: true });
    worker.stores.set("belilog-pwa:%2Fbelilog%2F:old", new Map());
    await worker.lifecycle("install");
    expect(worker.stores.has("belilog-pwa:%2Fbelilog%2F:old")).toBe(true);
  });
  it("activation deletes only this app scope's retired caches", async () => {
    const worker = runtime({ active: true });
    for (const name of [
      "belilog-pwa:%2Fbelilog%2F:old",
      "belilog-pwa:%2F:other",
      "another-pages-app",
      "user-cache",
    ]) {
      worker.stores.set(name, new Map());
    }
    await worker.lifecycle("install");
    await worker.lifecycle("activate");
    expect([...worker.stores.keys()].sort()).toEqual(
      [
        "another-pages-app",
        "belilog-pwa:%2F:other",
        "belilog-pwa:%2Fbelilog%2F:new",
        "user-cache",
      ].sort(),
    );
  });
  it("serves the coherent cached app shell for scoped navigations", async () => {
    const worker = runtime();
    await worker.lifecycle("install");
    expect(await worker.request(`${origin}/belilog/`, "navigate")).toBe(
      `cached:${origin}/belilog/index.html`,
    );
    expect(await worker.request(`${origin}/belilog/tracker`, "navigate")).toBe(
      `cached:${origin}/belilog/index.html`,
    );
    expect(worker.network).not.toHaveBeenCalled();
  });
  it("serves known lazy assets and report fonts without a network", async () => {
    const worker = runtime();
    await worker.lifecycle("install");
    expect(
      await worker.request(`${origin}/belilog/assets/tracker-abc.js`),
    ).toContain("cached:");
    expect(
      await worker.request(`${origin}/belilog/fonts/report-font.ttf`),
    ).toContain("cached:");
    expect(worker.network).not.toHaveBeenCalled();
  });
  it("serves allowlisted immutable module requests even when server Vary differs from precache GETs", async () => {
    const worker = runtime({ vary: true });
    await worker.lifecycle("install");
    expect(
      await worker.request(`${origin}/belilog/assets/tracker-abc.js`),
    ).toContain("cached:");
    expect(worker.network).not.toHaveBeenCalled();
  });
  it.each([
    [`${origin}/another-app/`, "navigate", "GET"],
    [`${origin}/belilogger/`, "navigate", "GET"],
    [`${origin}/belilog/api/expenses`, "cors", "GET"],
    [`${origin}/belilog/index.html`, "cors", "POST"],
    ["https://api.frankfurter.dev/v1/latest", "cors", "GET"],
  ])(
    "leaves unrelated, dynamic and non-GET requests alone: %s",
    async (url, mode, method) => {
      const worker = runtime();
      await worker.lifecycle("install");
      expect(await worker.request(url, mode, method)).toBeUndefined();
      expect(worker.network).not.toHaveBeenCalled();
    },
  );
});

describe("offline release identity", () => {
  const assets = [
    { name: "index.html", content: new TextEncoder().encode("app") },
  ];
  it("changes when only the worker implementation changes", () => {
    const first = appWorker("/belilog/", "", ["index.html"]);
    const second = first.replace("cache: 'reload'", "cache: 'no-store'");
    expect(releaseRevision(first, assets)).not.toBe(
      releaseRevision(second, assets),
    );
  });
  it("changes when public/PDF assets change without changing their names", () => {
    const worker = appWorker("/belilog/", "", ["index.html"]);
    expect(releaseRevision(worker, assets)).not.toBe(
      releaseRevision(worker, [
        {
          name: "index.html",
          content: new TextEncoder().encode("updated app"),
        },
      ]),
    );
  });
  it("is stable for the exact same complete release", () => {
    const worker = appWorker("/belilog/", "", ["index.html"]);
    expect(releaseRevision(worker, assets)).toBe(
      releaseRevision(worker, assets),
    );
  });
});
