import type { MessageKey } from "../lib/messages";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ListChecks,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import type { AppData } from "../lib/finance";
import type { Page } from "../hooks/appTypes";
import { translate } from "../lib/i18n";
import { pageLabels } from "../lib/navigation";
import StreakBadge from "./StreakBadge";

interface Props {
  data: AppData;
  page: Page;
  storageOk: boolean;
  initials: string;
  onNavigate: (page: Page) => void;
  onToggleTheme: () => void;
  children: ReactNode;
  overlays: ReactNode;
}
export default function AppShell({
  data,
  page,
  storageOk,
  initials,
  onNavigate,
  onToggleTheme,
  children,
  overlays,
}: Props) {
  const language = data.profile.language;
  const tr = (text: MessageKey) => translate(language, text);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={() => onNavigate("overview")}
          aria-label={tr("ui.belilogHome")}
        >
          <span className="brand-mark">
            <img
              src={`${import.meta.env.BASE_URL}belilog-icon-512.png`}
              alt=""
            />
          </span>
          <span className="brand-name">
            BeliLog
            <span className="brand-japanese" lang="ja">
              ベリログ
            </span>
            <span className="brand-tagline">Every Berry Counts.</span>
          </span>
        </a>
        <nav className="nav-list" aria-label={tr("ui.mainNavigation")}>
          {(
            [
              {
                id: "overview",
                label: tr("nav.overview"),
                shortLabel: tr("nav.overview"),
                icon: LayoutDashboard,
              },
              {
                id: "tracker",
                label: tr("ui.expenseTracker"),
                shortLabel: tr("nav.tracker"),
                icon: Wallet,
              },
              {
                id: "shopping",
                label: tr("nav.shopping"),
                shortLabel: tr("category.shopping"),
                icon: ListChecks,
              },
              {
                id: "profile",
                label: tr("ui.myProfile"),
                shortLabel: tr("nav.profile"),
                icon: UserRound,
              },
            ] as const
          ).map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`nav-item ${page === item.id ? "nav-active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              aria-label={item.label}
              onClick={() => onNavigate(item.id)}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span className="nav-label">
                <span className="nav-label-full">{item.label}</span>
                <span className="nav-label-short">{item.shortLabel}</span>
              </span>
              {item.id === "tracker" && data.transactions.length > 0 && (
                <span className="nav-count">{data.transactions.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`local-status ${!storageOk ? "storage-error" : ""}`}>
            <span className="status-dot" />
            <span>
              {storageOk ? tr("ui.savedOnThisDevice") : tr("ui.unableToSave")}
            </span>
            <ShieldCheck size={14} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <strong>{tr(pageLabels[page])}</strong>
          </div>
          <div className="topbar-actions">
            <StreakBadge
              transactions={data.transactions}
              ledger={data.streak}
              language={language}
              onClick={() => onNavigate("overview")}
            />
            <button
              className="theme-button icon-button"
              onClick={onToggleTheme}
              aria-label={tr("ui.switchTheme")}
              title={tr("ui.switchTheme")}
            >
              {data.profile.theme === "dark" ||
              (data.profile.theme === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches) ? (
                <Sun size={19} />
              ) : (
                <Moon size={19} />
              )}
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar"
              onClick={() => onNavigate("profile")}
              title={tr("ui.openProfile")}
              aria-label={tr("ui.openProfile")}
            >
              {data.profile.avatar ? (
                <img src={data.profile.avatar} alt={tr("ui.userAvatar")} />
              ) : (
                initials || tr("ui.u")
              )}
            </button>
          </div>
        </header>
        <main className="workspace" id="main-content">
          {children}
        </main>
      </div>
      {overlays}
    </div>
  );
}
