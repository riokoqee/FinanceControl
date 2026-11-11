/** The app shell is cached separately from financial data, which remains in the existing store. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export interface PwaStatus {
  phase: "preparing" | "ready" | "failed" | "unavailable";
  update: "idle" | "checking" | "waiting" | "current" | "failed";
  install: "none" | "available" | "installed" | "ios";
  installing: boolean;
  online: boolean;
}
const listeners = new Set<() => void>();
let snapshot: PwaStatus = {
  phase: "unavailable",
  update: "idle",
  install: "none",
  installing: false,
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
};
let registration: ServiceWorkerRegistration | undefined;
let prompt: InstallPrompt | undefined;
let started = false;
const watched = new WeakSet<ServiceWorker>();

function publish(patch: Partial<PwaStatus>) {
  const next = { ...snapshot, ...patch };
  if (
    (Object.keys(next) as (keyof PwaStatus)[]).every(
      (key) => next[key] === snapshot[key],
    )
  )
    return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}
export const getPwaStatus = () => snapshot;
export function subscribePwa(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The initial install briefly occupies waiting too; only an existing active worker makes it an update. */
export function isPwaUpdateWaiting(
  value: Pick<ServiceWorkerRegistration, "active" | "waiting">,
) {
  return Boolean(
    value.active && value.waiting && value.active !== value.waiting,
  );
}

function watch(worker: ServiceWorker) {
  if (watched.has(worker)) return;
  watched.add(worker);
  const changed = () => {
    if (registration && isPwaUpdateWaiting(registration))
      publish({ update: "waiting" });
    if (
      worker.state === "activated" ||
      registration?.active?.state === "activated"
    )
      publish({
        phase: "ready",
        ...(snapshot.update === "waiting" &&
        registration &&
        !isPwaUpdateWaiting(registration)
          ? { update: "idle" as const }
          : {}),
      });
    if (worker.state === "redundant" && !registration?.active)
      publish({ phase: "failed" });
    if (
      worker.state === "redundant" &&
      registration?.active &&
      !registration.waiting
    )
      publish({ update: "failed" });
  };
  worker.addEventListener("statechange", changed);
  changed();
}

/** Registration waits for the first render/load. It never reloads a page or activates a waiting update. */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  publish({ install: installed ? "installed" : ios ? "ios" : "none" });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event as InstallPrompt;
    publish({ install: "available" });
  });
  window.addEventListener("appinstalled", () => {
    prompt = undefined;
    publish({ install: "installed", installing: false });
  });
  const connectivity = () => publish({ online: navigator.onLine });
  window.addEventListener("online", connectivity);
  window.addEventListener("offline", connectivity);
  if (
    !import.meta.env.PROD ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return;
  publish({ phase: "preparing" });
  const register = () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}belilog-sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((value) => {
        registration = value;
        if (value.active) watch(value.active);
        if (value.installing) watch(value.installing);
        if (isPwaUpdateWaiting(value)) publish({ update: "waiting" });
        value.addEventListener("updatefound", () => {
          if (value.installing) watch(value.installing);
        });
      })
      .catch(() => publish({ phase: "failed" }));
  };
  const idle = () => {
    if ("requestIdleCallback" in window)
      window.requestIdleCallback(register, { timeout: 2000 });
    else setTimeout(register, 0);
  };
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

export async function installPwa() {
  const offer = prompt;
  if (!offer || snapshot.installing) return;
  prompt = undefined;
  publish({ installing: true });
  try {
    await offer.prompt();
    const choice = await offer.userChoice;
    publish({ install: choice.outcome === "accepted" ? "installed" : "none" });
  } catch {
    publish({ install: "none" });
  } finally {
    publish({ installing: false });
  }
}

export async function checkPwaUpdate() {
  if (
    !registration ||
    snapshot.update === "checking" ||
    snapshot.update === "waiting"
  )
    return;
  publish({ update: "checking" });
  try {
    await registration.update();
    if (isPwaUpdateWaiting(registration)) publish({ update: "waiting" });
    else if (registration.installing) {
      const worker = registration.installing;
      watch(worker);
      await new Promise<void>((resolve) => {
        const done = () => {
          if (
            worker.state !== "installed" &&
            worker.state !== "activated" &&
            worker.state !== "redundant"
          )
            return;
          worker.removeEventListener("statechange", done);
          resolve();
        };
        worker.addEventListener("statechange", done);
        done();
      });
      if (isPwaUpdateWaiting(registration)) publish({ update: "waiting" });
      else if (worker.state === "redundant") publish({ update: "failed" });
      else publish({ update: "current" });
    } else publish({ update: "current" });
  } catch {
    publish({ update: "failed" });
  }
}
