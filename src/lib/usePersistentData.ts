import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppData } from './finance';
import { STORAGE_KEY } from './finance';
import { mergeAppData, readStoredData, writeStoredData } from './storage';

type Change = AppData | ((current: AppData) => AppData);

/** Commit before rendering success; storage events only read, never echo writes. */
export function usePersistentData() {
  const [initial] = useState(() => readStoredData());
  const [data, renderData] = useState(initial.data);
  const current = useRef(data);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState('');
  const lastError = useRef('');
  const commit = useCallback((change: Change, replaceCorrupt = false): AppData | null => {
    try {
      const base = current.current;
      const desired = typeof change === 'function' ? change(base) : change;
      if (desired === base && !replaceCorrupt) return base;
      const stored = readStoredData();
      const next = replaceCorrupt ? desired : mergeAppData(base, stored.data, desired);
      writeStoredData(next, undefined, { replaceCorrupt });
      // Event handlers can flush several rows before React renders.
      current.current = next;
      renderData(next);
      setStatus('ready');
      setError('');
      lastError.current = '';
      return next;
    } catch (cause) {
      lastError.current = cause instanceof Error ? cause.message : 'Не удалось сохранить изменения в браузере.';
      setError(lastError.current);
      return null;
    }
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const incoming = readStoredData();
      setStatus(incoming.status);
      if (incoming.status === 'ready' || incoming.status === 'empty') {
        current.current = incoming.data;
        renderData(incoming.data);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return { data, current, commit, status, error, lastError };
}
