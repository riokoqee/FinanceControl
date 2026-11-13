import { Check, Download, RefreshCw, WifiOff } from "lucide-react";
import type { Language } from "../lib/finance";
import { pwaCopy } from "../lib/pwaCopy";
import { usePwa } from "../hooks/usePwa";
import Button from "./Button";
import "./PwaSettings.css";

export default function PwaSettings({
  language,
  onFlushProfile,
}: {
  language: Language;
  onFlushProfile: () => boolean;
}) {
  const pwa = usePwa();
  const t = pwaCopy[language];
  return (
    <section className="panel pwa-settings" aria-label={t.title}>
      <div className="pwa-settings-heading">
        <h3>{t.title}</h3>
        {pwa.phase === "ready" && <Check size={17} aria-hidden="true" />}
      </div>
      <p className="field-hint" role="status">
        {t[pwa.phase]}
        {!pwa.online && (
          <>
            {" "}
            · <WifiOff size={13} aria-hidden="true" /> {t.offline}
          </>
        )}
      </p>
      {pwa.install === "ios" && <p className="field-hint">{t.ios}</p>}
      {pwa.install === "installed" && (
        <p className="field-hint">{t.installed}</p>
      )}
      <div className="pwa-settings-actions">
        {pwa.install === "available" && (
          <Button
            onClick={() => {
              void pwa.installApp();
            }}
            disabled={pwa.installing}
          >
            <Download size={15} aria-hidden="true" />
            {t.install}
          </Button>
        )}
        {pwa.phase === "ready" && pwa.update !== "waiting" && (
          <Button
            onClick={() => {
              void pwa.checkUpdate();
            }}
            disabled={pwa.update === "checking" || !pwa.online}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {pwa.update === "checking" ? t.checking : t.check}
          </Button>
        )}
      </div>
      {(pwa.update === "waiting" || pwa.applyError === "profile") && (
        <>
          <p className="field-hint" role="status">
            {t.waiting}
          </p>
          <Button
            onClick={() => {
              pwa.applyUpdate(onFlushProfile);
            }}
            disabled={pwa.applying}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {pwa.applying ? t.applying : t.apply}
          </Button>
          <p className="field-hint">{t.applyHint}</p>
        </>
      )}
      {pwa.applyError && (
        <p className="field-hint" role="status">
          {pwa.applyError === "profile" ? t.profileFailed : t.applyFailed}
        </p>
      )}
      {pwa.update === "current" && (
        <p className="field-hint" role="status">
          {t.current}
        </p>
      )}
      {pwa.update === "failed" && (
        <p className="field-hint" role="status">
          {t.updateFailed}
        </p>
      )}
      <p className="field-hint">{t.hint}</p>
    </section>
  );
}
