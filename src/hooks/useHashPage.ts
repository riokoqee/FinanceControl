import { useCallback, useRef, useSyncExternalStore } from "react";
import type { Page } from "./appTypes";

function readPage(): Page {
  const value = window.location.hash.slice(1);
  return value === "tracker" || value === "shopping" || value === "profile"
    ? value
    : "overview";
}

/** The URL is the route state, including direct links and browser back/forward. */
export function useHashPage() {
  const beforeChange = useRef<() => void>(() => {});
  const preparedHash = useRef<string | null>(null);
  const subscribe = useCallback((notify: () => void) => {
    const changed = () => {
      if (preparedHash.current !== window.location.hash) beforeChange.current();
      preparedHash.current = null;
      notify();
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const page = useSyncExternalStore(
    subscribe,
    readPage,
    () => "overview" as Page,
  );
  const navigate = useCallback((next: Page) => {
    // Flush while the profile is still active, before React observes the new URL.
    beforeChange.current();
    const hash = `#${next}`;
    if (window.location.hash !== hash) preparedHash.current = hash;
    window.location.hash = next;
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);
  return { page, navigate, beforeChange };
}
