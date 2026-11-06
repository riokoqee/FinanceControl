import { useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  ArrowUpRight,
  Camera,
  Check,
  CircleHelp,
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
import { CURRENCIES, RATE_LABEL } from "../lib/finance";
import type { AppData, Currency, Language, Profile } from "../lib/finance";
import { translate } from "../lib/i18n";
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
  onExport: () => void;
  onImport: (file?: File) => void;
  onDemo: () => void;
  onReset: () => void;
  onAddExpense: () => void;
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
  onExport,
  onImport,
  onDemo,
  onReset,
  onAddExpense,
}: ProfilePageProps) {
  const tr = (text: string) => translate(language, text);
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
            <h2>{tr("Личные настройки")}</h2>
          </div>
          <UserRound size={20} className="muted-icon" />
        </div>
        <div className="profile-identity">
          <button
            type="button"
            className="profile-avatar profile-avatar-edit"
            aria-label={tr("Редактировать аватар")}
            title={tr("Редактировать аватар")}
            onClick={() =>
              data.profile.avatar ? onEditAvatar() : avatarRef.current?.click()
            }
          >
            {data.profile.avatar ? (
              <img src={data.profile.avatar} alt={tr("Аватар пользователя")} />
            ) : (
              initials || tr("П")
            )}
            <span className="profile-avatar-edit-icon" aria-hidden="true">
              <Camera size={13} />
            </span>
          </button>
          <div>
            <strong>
              {data.profile.name === "Пользователь"
                ? tr("Пользователь")
                : data.profile.name}
            </strong>
            <span>{tr("Ваше личное финансовое пространство")}</span>
          </div>
          <span className="profile-local-badge">{tr("Локальный профиль")}</span>
        </div>
        <div className="avatar-editor">
          <div className="avatar-editor-actions">
            <Button onClick={() => avatarRef.current?.click()}>
              <Camera size={15} />
              {tr("Сменить аватар")}
            </Button>
            {data.profile.avatar && (
              <Button onClick={() => onEditAvatar()}>
                <Pencil size={15} />
                {tr("Редактировать аватар")}
              </Button>
            )}
            {data.profile.avatar && (
              <Button onClick={onRemoveAvatar}>
                <Trash2 size={15} />
                {tr("Удалить аватар")}
              </Button>
            )}
          </div>
          <span className="field-hint">
            {tr(
              "Переместите и увеличьте фото перед сохранением. PNG, JPG или WebP до 8 МБ.",
            )}
          </span>
          <input
            className="sr-only"
            ref={avatarRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={tr("Выбрать аватар")}
            onChange={(e) => {
              onAvatarSelect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="form-row">
          <label className="field">
            <span className="field-label">{tr("Как к вам обращаться")}</span>
            <input
              className="form-input"
              required
              maxLength={60}
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
              placeholder={tr("Ваше имя")}
            />
          </label>
          <label className="field">
            <span className="field-label">
              Email <small>{tr("необязательно")}</small>
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
          <h3>{tr("Ваш финансовый ориентир")}</h3>
          <p className="field-hint">{tr("Один лимит для всех месяцев.")}</p>
          <div className="form-row">
            <label className="field">
              <span className="field-label">{tr("Основная валюта")}</span>
              <select
                className="form-input"
                value={profile.currency}
                onChange={(e) => onCurrencyChange(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {tr(c.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{tr("Бюджет на месяц")}</span>
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
            </label>
          </div>
          <div className="rates-note">
            <CircleHelp size={16} />
            <p>
              <strong>{tr(RATE_LABEL)}</strong>
              <span>
                {tr(
                  "Курсы не обновляются. Расходы хранятся в исходной валюте.",
                )}
              </span>
            </p>
          </div>
        </div>
        <div className="settings-group">
          <h3>{tr("Тема оформления")}</h3>
          <div className="theme-options">
            {(
              [
                { id: "light", label: tr("Светлая"), icon: Sun },
                { id: "dark", label: tr("Тёмная"), icon: Moon },
                {
                  id: "system",
                  label: tr("Как в системе"),
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
                <span>{tr(t.label)}</span>
                {profile.theme === t.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-group">
          <h3>{tr("Язык интерфейса")}</h3>
          <label className="field">
            <span className="sr-only">{tr("Язык интерфейса")}</span>
            <select
              className="form-input"
              value={language}
              onChange={(event) =>
                onLanguageChange(event.target.value as Language)
              }
            >
              <option value="ru">{tr("Русский")}</option>
              <option value="en">{tr("Английский")}</option>
            </select>
          </label>
        </div>
        <div className="profile-save">
          {storageError && (
            <Button onClick={onReload}>
              {tr("Загрузить актуальный профиль")}
            </Button>
          )}
          <span>
            <ShieldCheck size={14} />
            {tr("Все настройки сохраняются автоматически.")}
          </span>
          <Button variant="primary" type="submit">
            <Check size={17} />
            {tr("Сохранить настройки")}
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
          <h2>{tr("Данные и резервные копии")}</h2>
          <p>
            {tr(
              "Записи хранятся в этом браузере. PDF-копия поможет перенести их на другое устройство.",
            )}
          </p>
          <div className="storage-details">
            <div>
              <span>{tr("Всего записей")}</span>
              <strong>{data.transactions.length}</strong>
            </div>
            <div>
              <span>{tr("Размер данных")}</span>
              <strong>
                {(dataSize / 1024).toFixed(1)} {tr("КБ")}
              </strong>
            </div>
            <div>
              <span>{tr("Состояние")}</span>
              <strong className={storageOk ? "storage-good" : "storage-error"}>
                {storageOk ? tr("Сохранено") : tr("Ошибка сохранения")}
              </strong>
            </div>
          </div>
          <div className="storage-actions">
            <Button onClick={onExport}>
              <Download size={16} />
              {tr("PDF-копия со всеми данными")}
            </Button>
            <Button onClick={() => importRef.current?.click()}>
              <Upload size={16} />
              {tr("Импортировать PDF-копию")}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".pdf,application/pdf,.json,application/json"
              aria-label={tr("Импортировать PDF-копию")}
              className="sr-only"
              onChange={(e) => {
                onImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          <p className="field-hint">
            {tr("PDF содержит расходы, список покупок, аватар и настройки.")}
          </p>
        </section>
        <section className="panel demo-card">
          <Sparkles size={19} />
          <div>
            <h3>{tr("Попробовать на примере")}</h3>
            <p>{tr("Демо с расходами, категориями и бюджетом.")}</p>
          </div>
          <button
            className="icon-button"
            onClick={onDemo}
            aria-label={tr("Загрузить демо")}
          >
            <ArrowUpRight size={20} />
          </button>
        </section>
        <div className="data-danger-zone">
          <button onClick={onReset}>
            <Trash2 size={15} />
            {tr("Удалить все данные")}
          </button>
          <p>
            {tr("Удаляет профиль, расходы и список покупок из этого браузера.")}
          </p>
        </div>
      </div>
      <StreakBounty
        transactions={data.transactions}
        profile={data.profile}
        language={language}
        variant="profile"
        celebration={celebration}
        onAddExpense={onAddExpense}
      />
      <ActivityCalendar transactions={data.transactions} language={language} />
    </div>
  );
}
