import type { MessageKey } from "../lib/messages";
import { useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  ArrowUpRight,
  Camera,
  Check,
  Download,
  Monitor,
  Moon,
  Pencil,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { CURRENCIES } from "../lib/finance";
import type { AppData, Currency, ExchangeRates, Language, Profile } from "../lib/finance";
import { translate } from "../lib/i18n";
import ExchangeRatesSettings from "../components/ExchangeRatesSettings";
import { settingsCopy } from "../lib/settingsCopy";
import Button from "../components/Button";
import ActivityCalendar from "../components/ActivityCalendar";
import StreakBounty from "../components/StreakBounty";
import type { BountyCelebration } from "../components/StreakBounty";

interface ProfilePageProps {
  data: AppData;
  profile: Profile;
  setProfile: Dispatch<SetStateAction<Profile>>;
  initials: string;
  language: Language;
  storageOk: boolean;
  storageError: string;
  celebration: BountyCelebration | null;
  onSave: () => void;
  onFlush: () => void;
  onReload: () => void;
  onAvatarSelect: (file?: File) => void;
  onEditAvatar: () => void;
  onRemoveAvatar: () => void;
  onCurrencyChange: (currency: Currency) => void;
  onThemeChange: (theme: Profile["theme"]) => void;
  onLanguageChange: (language: Language) => void;
  onExchangeRatesSave: (base: ExchangeRates | undefined, next: ExchangeRates) => boolean;
  onExportJson: () => void;
  onExportCsv: () => void;
  onExport: () => void;
  onImport: (file?: File) => void;
  onDemo: () => void;
  onReset: () => void;
  onAddExpense: () => void;
  onNoSpend: (day: string) => void;
  onConfirmDay: (day: string) => void;
}

export default function ProfilePage({
  data,
  profile,
  setProfile,
  initials,
  language,
  storageOk,
  storageError,
  celebration,
  onSave,
  onFlush,
  onReload,
  onAvatarSelect,
  onEditAvatar,
  onRemoveAvatar,
  onCurrencyChange,
  onThemeChange,
  onLanguageChange,
  onExchangeRatesSave,
  onExportJson,
  onExportCsv,
  onExport,
  onImport,
  onDemo,
  onReset,
  onAddExpense,
  onNoSpend,
  onConfirmDay,
}: ProfilePageProps) {
  const tr = (text: MessageKey) => translate(language, text);
  const avatarRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  // A name keystroke should not serialize an unchanged multi-megabyte journal again.
  const transactionsSize = useMemo(
    () => new Blob([JSON.stringify(data.transactions)]).size,
    [data.transactions],
  );
  const shoppingSize = useMemo(
    () => new Blob([JSON.stringify(data.shoppingList ?? [])]).size,
    [data.shoppingList],
  );
  const dataSize = useMemo(
    () =>
      new Blob([
        JSON.stringify({
          ...data,
          transactions: [],
          ...(data.shoppingList ? { shoppingList: [] } : {}),
        }),
      ]).size +
      transactionsSize -
      2 +
      (data.shoppingList ? shoppingSize - 2 : 0),
    [data, transactionsSize, shoppingSize],
  );
  return (
    <div className="profile-grid">
      <form
        className="panel profile-form"
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            onFlush();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="panel-header">
          <div>
            <h2>{tr("ui.personalSettings")}</h2>
          </div>
          <UserRound size={20} className="muted-icon" />
        </div>
        <div className="profile-identity">
          <button
            type="button"
            className="profile-avatar profile-avatar-edit"
            aria-label={tr("ui.editAvatar")}
            title={tr("ui.editAvatar")}
            onClick={() =>
              data.profile.avatar ? onEditAvatar() : avatarRef.current?.click()
            }
          >
            {data.profile.avatar ? (
              <img src={data.profile.avatar} alt={tr("ui.userAvatar")} />
            ) : (
              initials || tr("ui.u")
            )}
            <span className="profile-avatar-edit-icon" aria-hidden="true">
              <Camera size={13} />
            </span>
          </button>
          <div>
            <strong>
              {data.profile.name === "Пользователь"
                ? tr("ui.user")
                : data.profile.name}
            </strong>
          </div>
        </div>
        <div className="avatar-editor">
          <div className="avatar-editor-actions">
            <Button onClick={() => avatarRef.current?.click()}>
              <Camera size={15} />
              {tr("ui.changeAvatar")}
            </Button>
            {data.profile.avatar && (
              <Button onClick={() => onEditAvatar()}>
                <Pencil size={15} />
                {tr("ui.editAvatar")}
              </Button>
            )}
            {data.profile.avatar && (
              <Button onClick={onRemoveAvatar}>
                <Trash2 size={15} />
                {tr("ui.removeAvatar")}
              </Button>
            )}
          </div>
          <input
            className="sr-only"
            ref={avatarRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={tr("ui.chooseAvatar")}
            onChange={(e) => {
              onAvatarSelect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="form-row">
          <label className="field">
            <span className="field-label">{tr("ui.whatShouldWeCallYou")}</span>
            <input
              className="form-input"
              required
              maxLength={80}
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
              placeholder={tr("ui.yourName")}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Email <small>{tr("ui.optional")}</small>
            </span>
            <input
              className="form-input"
              type="email"
              maxLength={254}
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
              placeholder="you@example.com"
            />
          </label>
        </div>
        <div className="settings-group">
          <div className="form-row">
            <label className="field">
              <span className="field-label">{tr("ui.mainCurrency")}</span>
              <select
                className="form-input"
                value={profile.currency}
                onChange={(e) => onCurrencyChange(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {tr(c.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{tr("ui.monthlyBudgetAlternative")}</span>
              <div className="input-prefix">
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  max="1000000000000"
                  step="0.01"
                  value={profile.monthlyBudget || ""}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      monthlyBudget: Number(e.target.value),
                    }))
                  }
                  placeholder="0"
                />
                <span>{profile.currency}</span>
              </div>
              <span className="field-hint">
                {tr("ui.oneBudgetForEveryMonth")}
              </span>
            </label>
          </div>
          <ExchangeRatesSettings rates={data.profile.exchangeRates} language={language} onSave={onExchangeRatesSave} />
        </div>
        <div className="settings-group">
          <h3>{tr("ui.appearance")}</h3>
          <div className="theme-options">
            {(
              [
                { id: "light", label: tr("theme.light"), icon: Sun },
                { id: "dark", label: tr("theme.dark"), icon: Moon },
                {
                  id: "system",
                  label: tr("ui.system"),
                  icon: Monitor,
                },
              ] as const
            ).map((t) => (
              <button
                type="button"
                key={t.id}
                className={`theme-option ${profile.theme === t.id ? "selected" : ""}`}
                onClick={() => {
                  onThemeChange(t.id);
                }}
              >
                <t.icon size={21} />
                <span>{t.label}</span>
                {profile.theme === t.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-group">
          <h3>{tr("ui.interfaceLanguage")}</h3>
          <label className="field">
            <span className="sr-only">{tr("ui.interfaceLanguage")}</span>
            <select
              className="form-input"
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as Language)
              }
            >
              <option value="ru">{tr("ui.russian")}</option>
              <option value="en">{tr("ui.english")}</option>
            </select>
          </label>
        </div>
        <div className="profile-save">
          {storageError && (
            <Button onClick={onReload}>
              {tr("ui.loadCurrentProfile")}
            </Button>
          )}
          <span>
            <ShieldCheck size={14} />
            {tr("ui.autosave")}
          </span>
          <Button variant="primary" type="submit">
            <Check size={17} />
            {tr("ui.saveSettings")}
          </Button>
        </div>
      </form>
      <div className="profile-right">
        <section className="panel storage-card">
          <div className="storage-illustration">
            <ShieldCheck size={32} strokeWidth={1.3} />
            <span className="storage-orbit orbit-one" />
            <span className="storage-orbit orbit-two" />
          </div>
          <h2>{tr("ui.data")}</h2>
          <p>
            {settingsCopy[language].localData}
          </p>
          <div className="storage-details">
            <div>
              <span>{tr("ui.totalRecords")}</span>
              <strong>{data.transactions.length}</strong>
            </div>
            <div>
              <span>{tr("ui.dataSize")}</span>
              <strong>
                {(dataSize / 1024).toFixed(1)} {tr("ui.kb")}
              </strong>
            </div>
            <div>
              <span>{tr("ui.status")}</span>
              <strong className={storageOk ? "storage-good" : "storage-error"}>
                {storageOk ? tr("ui.saved") : tr("ui.saveFailed")}
              </strong>
            </div>
          </div>
          <div className="storage-actions">
            <Button onClick={onExport}>
              <Download size={16} />
              {tr("ui.pdfBackupWithAllYourData")}
            </Button>
            <Button onClick={onExportJson}><Download size={16} />{settingsCopy[language].jsonBackup}</Button>
            <Button onClick={onExportCsv}><Download size={16} />{settingsCopy[language].csvReport}</Button>
            <Button onClick={() => importRef.current?.click()}>
              <Upload size={16} />
              {tr("ui.importPdfBackup")}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".pdf,application/pdf,.json,application/json"
              aria-label={tr("ui.importPdfBackup")}
              className="sr-only"
              onChange={(e) => {
                onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </section>
        <section className="panel demo-card">
          <Sparkles size={19} />
          <div>
            <h3>{tr("ui.tryAnExample")}</h3>
          </div>
          <button
            className="icon-button"
            onClick={onDemo}
            aria-label={tr("ui.loadDemo")}
          >
            <ArrowUpRight size={20} />
          </button>
        </section>
        <div className="data-danger-zone">
          <button onClick={onReset}>
            <Trash2 size={15} />
            {tr("ui.deleteAllData")}
          </button>
          <p>
            {tr("ui.deletesAllBelilogDataFromThisBrowser")}
          </p>
        </div>
      </div>
      <StreakBounty
        transactions={data.transactions}
        ledger={data.streak}
        profile={data.profile}
        language={language}
        variant="profile"
        celebration={celebration}
        onAddExpense={onAddExpense}
        onNoSpend={onNoSpend}
        onConfirmDay={onConfirmDay}
      />
      <ActivityCalendar transactions={data.transactions} ledger={data.streak} language={language} />
    </div>
  );
}
