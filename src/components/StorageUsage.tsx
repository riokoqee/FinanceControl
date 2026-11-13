import { useEffect, useState } from "react";
import type { AppData, Language } from "../lib/finance";
import { storageCopy } from "../lib/storageCopy";

export default function StorageUsage({
  language,
  data,
}: {
  language: Language;
  data: AppData;
}) {
  const [estimate, setEstimate] = useState<{
    usage: number;
    quota: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        if (!navigator.storage?.estimate) return;
        const { usage, quota } = await navigator.storage.estimate();
        if (!active) return;
        setEstimate(
          typeof usage === "number" &&
            Number.isFinite(usage) &&
            usage >= 0 &&
            typeof quota === "number" &&
            Number.isFinite(quota) &&
            quota > 0
            ? { usage, quota }
            : null,
        );
      } catch {
        if (active) setEstimate(null);
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [data]);
  if (!estimate) return null;
  const copy = storageCopy[language];
  const format = (bytes: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(
      bytes / 1024 ** 2,
    );
  return (
    <div className="storage-estimate" title={copy.usageHint}>
      <span>{copy.usage}</span>
      <strong>
        {format(estimate.usage)} / {format(estimate.quota)} {copy.mb} (
        {Math.round((estimate.usage / estimate.quota) * 100)}%)
      </strong>
    </div>
  );
}
