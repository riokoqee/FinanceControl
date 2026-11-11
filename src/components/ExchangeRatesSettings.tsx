import { useEffect, useId, useRef, useState } from "react";
import type { ExchangeRates, ExchangeRateSync, Language } from "../lib/finance";
import type { AutomaticRatesController } from "../hooks/useAutomaticRates";
import { parseExchangeRate, resolveExchangeRates } from "../lib/currency";
import { settingsCopy } from "../lib/settingsCopy";
import Button from "./Button";
import "./ExchangeRatesSettings.css";

function draftFrom(rates?: ExchangeRates, sync?: ExchangeRateSync) {
  const values = resolveExchangeRates(rates);
  return {
    base: rates,
    sync,
    eur: String(values.EUR),
    kzt: String(values.KZT),
  };
}

export default function ExchangeRatesSettings({
  rates,
  sync,
  automatic,
  language,
  onSave,
}: {
  rates?: ExchangeRates;
  sync?: ExchangeRateSync;
  automatic: AutomaticRatesController;
  language: Language;
  onSave: (
    base: ExchangeRates | undefined,
    next: ExchangeRates,
    baseSync?: ExchangeRateSync,
  ) => boolean;
}) {
  const t = settingsCopy[language];
  const [draft, setDraft] = useState(() => draftFrom(rates, sync));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<"invalidRates" | "ratesFailed" | null>(
    null,
  );
  const errorId = useId();
  const hintId = useId();
  const isAutomatic = sync?.mode === "automatic";
  const eurRef = useRef<HTMLInputElement>(null);
  const kztRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!dirty) setDraft(draftFrom(rates, sync));
  }, [rates, sync, dirty]);

  function save() {
    const EUR = parseExchangeRate(draft.eur);
    const KZT = parseExchangeRate(draft.kzt);
    if (EUR === null || KZT === null) {
      setError("invalidRates");
      (EUR === null ? eurRef : kztRef).current?.focus();
      return;
    }
    if (isAutomatic || !onSave(draft.base, { USD: 1, EUR, KZT }, draft.sync)) {
      setError("ratesFailed");
      return;
    }
    setDirty(false);
    setError(null);
  }

  return (
    <fieldset className="exchange-rates-settings">
      <legend>{t.rates}</legend>
      <p className="field-hint">{t.ratesHint}</p>
      <label className="field exchange-rate-mode">
        <span className="field-label">{t.rateMode}</span>
        <select
          className="form-input"
          value={isAutomatic ? "automatic" : "manual"}
          disabled={dirty}
          aria-describedby={dirty ? hintId : undefined}
          onChange={(event) =>
            automatic.setMode(
              event.target.value === "automatic" ? "automatic" : "manual",
            )
          }
        >
          <option value="manual">{t.manualMode}</option>
          <option value="automatic">{t.automaticMode}</option>
        </select>
      </label>
      {dirty && (
        <p className="field-hint" id={hintId}>
          {isAutomatic ? t.rateDraftConflict : t.cancelBeforeMode}
        </p>
      )}
      {isAutomatic && (
        <p className="field-hint exchange-rate-provider">{t.automaticHint}</p>
      )}
      {isAutomatic && !dirty && sync?.dates && (
        <div className="exchange-rate-dates">
          <span>Frankfurter · {t.providerDates}</span>
          <span>
            EUR <time dateTime={sync.dates.EUR}>{sync.dates.EUR}</time> · KZT{" "}
            <time dateTime={sync.dates.KZT}>{sync.dates.KZT}</time>
          </span>
          {sync.checkedAt && (
            <span>
              {t.checkedRates}:{" "}
              <time dateTime={sync.checkedAt}>
                {new Intl.DateTimeFormat(
                  language === "en" ? "en-GB" : "ru-RU",
                  { dateStyle: "medium", timeStyle: "short" },
                ).format(new Date(sync.checkedAt))}
              </time>
            </span>
          )}
        </div>
      )}
      {isAutomatic && !dirty && !sync?.dates && (
        <p className="field-hint">{t.awaitingRates}</p>
      )}
      {!rates && (
        <p className="field-hint exchange-rates-estimates">{t.estimates}</p>
      )}
      <div className="form-row">
        {(
          [
            ["eur", t.eur, eurRef],
            ["kzt", t.kzt, kztRef],
          ] as const
        ).map(([key, label, ref]) => (
          <label className="field" key={key}>
            <span className="field-label">{label}</span>
            <input
              ref={ref}
              className="form-input"
              type="text"
              inputMode="decimal"
              maxLength={24}
              readOnly={isAutomatic}
              value={draft[key]}
              aria-invalid={error === "invalidRates" || undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  [key]: event.target.value,
                }));
                setDirty(true);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isAutomatic) {
                  event.preventDefault();
                  save();
                }
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="exchange-rates-error" role="alert">
          {t[error]}
        </p>
      )}
      {isAutomatic && automatic.error && (
        <p className="exchange-rates-error" role="status">
          {
            t[
              {
                offline: "offlineRates",
                timeout: "timeoutRates",
                invalid: "invalidFeed",
                network: "networkRates",
                conflict: "conflictRates",
              }[automatic.error] as
                | "offlineRates"
                | "timeoutRates"
                | "invalidFeed"
                | "networkRates"
                | "conflictRates"
            ]
          }
        </p>
      )}
      <div className="exchange-rates-actions">
        {isAutomatic ? (
          <Button
            onClick={() => {
              void automatic.refresh();
            }}
            disabled={automatic.loading}
          >
            {automatic.loading ? t.refreshingRates : t.refreshRates}
          </Button>
        ) : (
          <Button onClick={save} disabled={!dirty && !!rates}>
            {t.saveRates}
          </Button>
        )}
        {(dirty || error) && (
          <Button
            onClick={() => {
              setDraft(draftFrom(rates, sync));
              setDirty(false);
              setError(null);
            }}
          >
            {t.cancel}
          </Button>
        )}
      </div>
    </fieldset>
  );
}
