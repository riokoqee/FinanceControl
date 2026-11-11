import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

export const PWA_WORKER = "belilog-sw.js";
export const PWA_MANIFEST = "manifest.webmanifest";

export function appManifest(base: string) {
  return {
    id: base,
    name: "BeliLog — Every Berry Counts",
    short_name: "BeliLog",
    description: "Personal expense tracker · Личный журнал расходов",
    lang: "ru",
    start_url: base,
    scope: base,
    display: "standalone",
    background_color: "#101D2C",
    theme_color: "#101D2C",
    icons: [
      {
        src: `${base}belilog-icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}belilog-icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

/** The worker only stores a complete, immutable app release. Financial data never enters it. */
export function appWorker(
  base: string,
  revision: string,
  files: string[],
): string {
  const prefix = `belilog-pwa:${encodeURIComponent(base)}:`;
  return `/* BeliLog offline app shell. Generated at build time; no user data. */
const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + ${JSON.stringify(revision)};
const BASE = ${JSON.stringify(base)};
const FILES = ${JSON.stringify(files)};
const URLS = FILES.map(path => new URL(BASE + path, self.location.origin).href);
const KNOWN = new Set(URLS);
const INDEX = new URL(BASE + 'index.html', self.location.origin).href;
const META = new URL(BASE + '__belilog_pwa_meta__', self.location.origin).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const upgrading = Boolean(self.registration.active);
      const cache = await caches.open(CACHE);
      await cache.addAll(URLS.map(url => new Request(url, { cache: 'reload', credentials: 'same-origin' })));
      await cache.put(META, new Response(upgrading ? 'upgrade' : 'first'));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const meta = await cache.match(META);
    const firstInstall = meta && await meta.text() === 'first';
    const previous = (await caches.keys()).filter(name => name.startsWith(PREFIX) && name !== CACHE);
    await Promise.all(previous.map(name => caches.delete(name)));
    // Only the first installation claims an uncontrolled page. Upgrades wait for old tabs to close.
    if (firstInstall) await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(INDEX, { ignoreVary: true })) || fetch(request)));
    return;
  }
  if (!KNOWN.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
});
`;
}

/** A worker-only fix must never reuse or delete the active release cache on install failure. */
export function releaseRevision(
  workerSource: string,
  assets: { name: string; content: Uint8Array }[],
): string {
  const hash = createHash("sha256").update(workerSource);
  for (const asset of assets) hash.update(asset.name).update(asset.content);
  return hash.digest("hex").slice(0, 20);
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? listFiles(join(directory, entry.name))
        : [join(directory, entry.name)],
    ),
  );
  return nested.flat();
}

/** Running after Vite writes HTML and copies public/ also includes every lazy import and report font. */
export function belilogPwa(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "belilog-pwa",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      const directory = config.build.outDir;
      const base = config.base;
      await writeFile(
        join(directory, PWA_MANIFEST),
        JSON.stringify(appManifest(base), null, 2),
      );
      const paths = (await listFiles(directory))
        .filter(
          (path) =>
            relative(directory, path).replaceAll("\\", "/") !== PWA_WORKER,
        )
        .sort();
      const assets = await Promise.all(
        paths.map(async (path) => ({
          name: relative(directory, path).replaceAll("\\", "/"),
          content: await readFile(path),
        })),
      );
      const files = assets.map((asset) => asset.name);
      const revision = releaseRevision(appWorker(base, "", files), assets);
      await writeFile(
        join(directory, PWA_WORKER),
        appWorker(base, revision, files),
      );
    },
  };
}
