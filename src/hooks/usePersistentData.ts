import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "../lib/finance";
import { STORAGE_KEY } from "../lib/finance";
import {
  commitStoredData,
  commitStoredMutation,
  readStoredData,
} from "../lib/storage/storage";

type Change = AppData | ((current: AppData) => AppData);

/** Commit before rendering success; storage events only read, never echo writes. */
export function usePersistentData() {
  const [initial] = useState(() => readStoredData());
  const [data, renderData] = useState(initial.data);
  const current = useRef(data);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState("");
  const lastError = useRef("");
  const persist = useCallback(
    (write: (base: AppData) => AppData): AppData | null => {
      try {
        const next = write(current.current);
        // Event handlers can flush several rows before React renders.
        current.current = next;
        renderData(next);
        setStatus("ready");
        setError("");
        lastError.current = "";
        return next;
      } catch (cause) {
        lastError.current =
          cause instanceof Error
            ? cause.message
            : "Не удалось сохранить изменения в браузере.";
        setError(lastError.current);
        return null;
      }
    },
    [],
  );
  const commit = useCallback(
    (change: Change, replaceCorrupt = false) =>
      persist((base) => {
        const desired = typeof change === "function" ? change(base) : change;
        return commitStoredData(base, desired, undefined, { replaceCorrupt });
      }),
    [persist],
  );
  const commitFresh = useCallback(
    (change: (current: AppData) => AppData) =>
      persist((base) => commitStoredMutation(base, change)),
    [persist],
  );
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const incoming = readStoredData(undefined, current.current);
      setStatus(incoming.status);
      if (incoming.status === "ready" || incoming.status === "empty") {
        current.current = incoming.data;
        renderData(incoming.data);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return { data, current, commit, commitFresh, status, error, lastError };
}
