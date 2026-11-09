import { useEffect, useId, useRef, useState } from "react";
import type { ExchangeRates, Language } from "../lib/finance";
import { parseExchangeRate, resolveExchangeRates } from "../lib/currency";
import { settingsCopy } from "../lib/settingsCopy";
import Button from "./Button";
import "./ExchangeRatesSettings.css";

function draftFrom(rates?: ExchangeRates) {
  const values = resolveExchangeRates(rates);
  return { base: rates, eur: String(values.EUR), kzt: String(values.KZT) };
}

export default function ExchangeRatesSettings({ rates, language, onSave }: {
  rates?: ExchangeRates;
  language: Language;
  onSave: (base: ExchangeRates | undefined, next: ExchangeRates) => boolean;
}) {
  const t = settingsCopy[language];
  const [draft, setDraft] = useState(() => draftFrom(rates));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<"invalidRates" | "ratesFailed" | null>(null);
  const errorId = useId();
  const eurRef = useRef<HTMLInputElement>(null);
  const kztRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!dirty) setDraft(draftFrom(rates));
  }, [rates, dirty]);

  function save() {
    const EUR = parseExchangeRate(draft.eur);
    const KZT = parseExchangeRate(draft.kzt);
    if (EUR === null || KZT === null) {
      setError("invalidRates");
      (EUR === null ? eurRef : kztRef).current?.focus();
      return;
    }
    if (!onSave(draft.base, { USD: 1, EUR, KZT })) {
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
      {!rates && <p className="field-hint exchange-rates-estimates">{t.estimates}</p>}
      <div className="form-row">
        {([['eur', t.eur, eurRef], ['kzt', t.kzt, kztRef]] as const).map(([key, label, ref]) => (
          <label className="field" key={key}>
            <span className="field-label">{label}</span>
            <input ref={ref} className="form-input" type="text" inputMode="decimal" maxLength={24}
              value={draft[key]} aria-invalid={error === "invalidRates" || undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setDraft((current) => ({ ...current, [key]: event.target.value }));
                setDirty(true);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); save(); }
              }} />
          </label>
        ))}
      </div>
      {error && <p id={errorId} className="exchange-rates-error" role="alert">{t[error]}</p>}
      <div className="exchange-rates-actions">
        <Button onClick={save} disabled={!dirty && !!rates}>{t.saveRates}</Button>
        {(dirty || error) && <Button onClick={() => {
          setDraft(draftFrom(rates)); setDirty(false); setError(null);
        }}>{t.cancel}</Button>}
      </div>
    </fieldset>
  );
}
