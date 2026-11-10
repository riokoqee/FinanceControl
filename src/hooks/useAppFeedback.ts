import { useEffect, useState } from "react";
import type { TrackingStats } from "../lib/streak/streakLedger";
import type { Celebration, Page, Toast } from "./appTypes";

export function useAppFeedback(
  page: Page,
  streak: TrackingStats,
  storageError: string,
) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  useEffect(() => {
    if (storageError) setToast({ message: storageError, error: true });
  }, [storageError]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 8000 : 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(
      () => setCelebration(null),
      Math.max(0, celebration.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [celebration]);
  useEffect(() => {
    setCelebration(null);
  }, [page]);
  useEffect(() => {
    if (
      celebration &&
      (!streak.activeToday || streak.current !== celebration.toDays)
    )
      setCelebration(null);
  }, [streak.activeToday, streak.current, celebration]);
  return { toast, setToast, celebration, setCelebration };
}
export type AppFeedback = ReturnType<typeof useAppFeedback>;
