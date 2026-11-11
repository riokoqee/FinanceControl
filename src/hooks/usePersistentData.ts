import { localizeError } from "../lib/localizedError";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "../lib/finance";
import { STORAGE_KEY } from "../lib/finance";
import {
  commitStoredData,
  commitStoredMutation,
  commitStoredOperation,
  readStoredData,
} from "../lib/storage/storage";
import type {
  StoredOperation,
  StoredOperationResult,
} from "../lib/storage/storage";

type Change = AppData | ((current: AppData) => AppData);

/** Commit before rendering success; storage events only read, never echo writes. */
export function usePersistentData() {
  const [initial] = useState(() => readStoredData());
  const [data, renderData] = useState(initial.data);
  const current = useRef(data);
  // Explicit full replacement invalidates asynchronous work even for equal snapshots.
  const replacementEpoch = useRef(0);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState("");
  const lastError = useRef("");
  const persist = useCallback(
    <R>(
      write: (base: AppData) => StoredOperationResult<R>,
    ): StoredOperationResult<R> | null => {
      try {
        const committed = write(current.current);
        const next = committed.data;
        // Event handlers can flush several rows before React renders.
        current.current = next;
        renderData(next);
        setStatus("ready");
        setError("");
        lastError.current = "";
        return committed;
      } catch (cause) {
        lastError.current = localizeError(
          current.current.profile.language,
          cause,
          "error.saveFailed",
        );
        setError(lastError.current);
        return null;
      }
    },
    [],
  );
  const commit = useCallback(
    (change: Change, replaceCorrupt = false) => {
      const saved = persist((base) => {
        const desired = typeof change === "function" ? change(base) : change;
        return {
          data: commitStoredData(base, desired, undefined, { replaceCorrupt }),
          result: undefined,
        };
      });
      if (saved && replaceCorrupt) replacementEpoch.current += 1;
      return saved?.data ?? null;
    },
    [persist],
  );
  const commitFresh = useCallback(
    (change: (current: AppData) => AppData) =>
      persist((base) => ({
        data: commitStoredMutation(base, change),
        result: undefined,
      }))?.data ?? null,
    [persist],
  );
  const commitOperation = useCallback(
    <R>(operation: StoredOperation<R>): StoredOperationResult<R> | null =>
      persist((base) => commitStoredOperation(base, operation)),
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
  return {
    data,
    current,
    replacementEpoch,
    commit,
    commitFresh,
    commitOperation,
    status,
    error,
    lastError,
  };
}
