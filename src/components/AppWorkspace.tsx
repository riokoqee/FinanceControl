import type { MessageKey } from "../lib/messages";
import { message } from "../lib/messages";
import { lazy, Suspense } from "react";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { CURRENCIES } from "../lib/finance";
import type { AppData, Currency } from "../lib/finance";
import { translate } from "../lib/i18n";
import { pageLabels } from "../lib/navigation";
import type { Page } from "../hooks/appTypes";
import type { AppFeedback } from "../hooks/useAppFeedback";
import type { BackupActions } from "../hooks/useBackupRestore";
import type { DialogController } from "../hooks/useDialogState";
import type { ExpenseView } from "../hooks/useExpenseView";
import type { ProfileSettings } from "../hooks/useProfileSettings";
import type { TransactionActions } from "../hooks/useTransactions";
import type { useShoppingActions } from "../hooks/useShoppingActions";
import type { useShoppingTemplates } from "../hooks/useShoppingTemplates";
import type { useTrackingActions } from "../hooks/useTrackingActions";
import FeatureBoundary from "./FeatureBoundary";
import LoadingState from "./LoadingState";
import ExpenseEmptyState from "./ExpenseEmptyState";
import Button from "./Button";
const OverviewPage = lazy(() => import("../pages/OverviewPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const TrackerPage = lazy(() => import("../pages/TrackerPage"));
const ShoppingList = lazy(() => import("./ShoppingList"));

interface Props {
  data: AppData;
  page: Page;
  storageOk: boolean;
  storageError: string;
  streakCurrent: number;
  navigate: (page: Page) => void;
  view: ExpenseView;
  settings: ProfileSettings;
  transactions: TransactionActions;
  shopping: ReturnType<typeof useShoppingActions>;
  templates: ReturnType<typeof useShoppingTemplates>;
  tracking: ReturnType<typeof useTrackingActions>;
  backup: BackupActions;
  dialogs: DialogController;
  feedback: AppFeedback;
}
export default function AppWorkspace({
  data,
  page,
  storageOk,
  storageError,
  streakCurrent,
  navigate,
  view,
  settings,
  transactions: actions,
  shopping,
  templates,
  tracking,
  backup,
  dialogs,
  feedback,
}: Props) {
  const language = data.profile.language;
  const currency = data.profile.currency;
  const tr = (text: MessageKey) => translate(language, text);
  const {
    month,
    setMonth,
    shiftMonth,
    summary,
    chartRange,
    setChartRange,
    search,
    setSearch,
    deferredSearch,
    category,
    setCategory,
    filterCurrency,
    setFilterCurrency,
    sort,
    setSort,
    allTime,
    setAllTime,
    filtered,
  } = view;
  const {
    profile,
    setProfile,
    flushProfile,
    reloadProfile,
    commitProfileFields,
    initials,
    updateCurrency,
    saveExchangeRates,
  } = settings;
  const { deleteTransaction } = actions;
  const {
    addPlannedItem,
    savePlannedPrice,
    updatePlannedItem,
    removePlannedItem,
    confirmPlannedPurchase,
  } = shopping;
  const { saveTemplate, applyTemplate, deleteTemplate } = templates;
  const { confirmTrackingDate } = tracking;
  const {
    pdfBusy,
    exportReport,
    exportCsvReport,
    exportBackup,
    exportJson,
    exportCsv,
    importBackup,
    showDemoBanner,
    startDemo,
  } = backup;
  const { celebration: bountyCelebration, setToast } = feedback;
  const setDetailId = dialogs.details;
  const setModal = dialogs.transaction;
  const resetFilters = () => {
    view.resetFilters();
    view.setAllTime(true);
  };
  const monthLabel = new Date(`${month}-01T12:00:00`)
    .toLocaleDateString(language === "en" ? "en-US" : "ru-RU", {
      month: "long",
      year: "numeric",
    })
    .replace(" г.", "");
  return (
    <div className="page-enter" key={page}>
      <div className="page-heading">
        <div className="heading-copy">
          <h1>
            {page === "overview"
              ? tr("ui.everythingUnderControl")
              : tr(pageLabels[page])}
            <span className="heading-dot">.</span>
          </h1>
        </div>
        {(page === "overview" || page === "tracker") && (
          <div className="header-actions">
            <Button
              className="export-button"
              onClick={exportReport}
              disabled={pdfBusy}
            >
              <Download size={17} />
              {pdfBusy ? "…" : tr("ui.createPdf")}
            </Button>
            <Button variant="primary" onClick={() => dialogs.transaction()}>
              <Plus size={19} />
              {tr("ui.addExpense")}
            </Button>
          </div>
        )}
      </div>
      {(page === "overview" || page === "tracker") && (
        <div className="period-bar">
          <div className="month-control">
            <button
              className="icon-button"
              onClick={() => shiftMonth(-1)}
              aria-label={tr("ui.previousMonth")}
            >
              <ChevronLeft size={17} />
            </button>
            <label className="month-picker">
              <span>{monthLabel}</span>
              <input
                type="month"
                value={month}
                min="1900-01"
                max="2200-12"
                aria-label={tr("ui.chooseMonth")}
                onChange={(e) => {
                  if (e.target.value) setMonth(e.target.value);
                }}
              />
            </label>
            <button
              className="icon-button"
              onClick={() => shiftMonth(1)}
              aria-label={tr("ui.nextMonth")}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <label className="currency-select">
            <span>{tr("ui.overviewCurrency")}</span>
            <select
              value={currency}
              onChange={(e) => updateCurrency(e.target.value as Currency)}
              aria-label={tr("ui.overviewCurrency")}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <FeatureBoundary language={language} key={page}>
        <Suspense fallback={<LoadingState />}>
          {page === "overview" && (
            <OverviewPage
              data={data}
              summary={summary}
              month={month}
              currency={currency}
              language={language}
              streakCurrent={streakCurrent}
              chartRange={chartRange}
              onChartRangeChange={setChartRange}
              celebration={
                bountyCelebration?.page === "overview"
                  ? bountyCelebration
                  : null
              }
              showDemoBanner={showDemoBanner}
              onDismissDemo={backup.dismissDemo}
              onDemo={startDemo}
              onConfigureBudgets={dialogs.budgets}
              onAddExpense={() => dialogs.transaction()}
              onNoSpend={confirmTrackingDate}
              onConfirmDay={confirmTrackingDate}
              onProfile={() => navigate("profile")}
              onTracker={() => navigate("tracker")}
              onShowAll={() => {
                setAllTime(false);
                setSearch("");
                setCategory("all");
                setFilterCurrency("all");
                navigate("tracker");
              }}
              onOpen={setDetailId}
              onEdit={setModal}
              onDelete={deleteTransaction}
              emptyState={
                <ExpenseEmptyState
                  language={language}
                  onAdd={() => dialogs.transaction()}
                  onReset={resetFilters}
                />
              }
            />
          )}
          {page === "shopping" && (
            <ShoppingList
              items={data.shoppingList ?? []}
              transactions={data.transactions}
              defaultCurrency={currency}
              language={language}
              onAdd={addPlannedItem}
              templates={data.shoppingTemplates ?? []}
              onSaveTemplate={saveTemplate}
              onApplyTemplate={applyTemplate}
              onDeleteTemplate={deleteTemplate}
              onPriceChange={savePlannedPrice}
              onUpdate={updatePlannedItem}
              onRemove={removePlannedItem}
              onConfirm={confirmPlannedPurchase}
            />
          )}
          {page === "tracker" && (
            <TrackerPage
              filtered={filtered}
              rates={data.profile.exchangeRates}
              sync={data.profile.exchangeRateSync}
              language={language}
              currency={currency}
              search={search}
              category={category}
              filterCurrency={filterCurrency}
              sort={sort}
              allTime={allTime}
              searchPending={search !== deferredSearch}
              paginationKey={view.paginationKey}
              storageOk={storageOk}
              pdfBusy={pdfBusy}
              emptyState={
                <ExpenseEmptyState
                  language={language}
                  isFiltered={data.transactions.length > 0}
                  onAdd={() => dialogs.transaction()}
                  onReset={resetFilters}
                />
              }
              onSearch={setSearch}
              onCategory={setCategory}
              onCurrencyFilter={setFilterCurrency}
              onSort={setSort}
              onAllTime={setAllTime}
              onOpen={setDetailId}
              onEdit={setModal}
              onDelete={deleteTransaction}
              onExport={exportReport}
              onExportCsv={exportCsvReport}
              onProfile={() => navigate("profile")}
            />
          )}
          {page === "profile" && (
            <ProfilePage
              data={data}
              profile={profile}
              setProfile={setProfile}
              initials={initials}
              language={language}
              storageOk={storageOk}
              storageError={storageError}
              celebration={
                bountyCelebration?.page === "profile" ? bountyCelebration : null
              }
              onFlush={flushProfile}
              preReplaceAvailable={backup.preReplaceAvailable}
              onRestorePreReplace={() => dialogs.confirm("pre-replace")}
              onReload={reloadProfile}
              onSave={() => {
                if (flushProfile())
                  setToast({
                    message: message(language, "ui.profileSettingsSaved"),
                  });
              }}
              onAvatarSelect={(file) => {
                if (file) dialogs.avatar({ file });
              }}
              onEditAvatar={() => dialogs.avatar({ src: data.profile.avatar })}
              onRemoveAvatar={() => {
                commitProfileFields({ avatar: undefined });
              }}
              onCurrencyChange={updateCurrency}
              onExchangeRatesSave={saveExchangeRates}
              automaticRates={settings.automaticRates}
              onThemeChange={(theme) => {
                commitProfileFields({ theme });
              }}
              onLanguageChange={(next) => {
                commitProfileFields({ language: next });
              }}
              onExport={exportBackup}
              onExportJson={exportJson}
              onExportCsv={() => exportCsv(data.transactions)}
              onImport={(file) => {
                void importBackup(file);
              }}
              onDemo={startDemo}
              onNoSpend={confirmTrackingDate}
              onConfirmDay={confirmTrackingDate}
              onReset={() => dialogs.confirm("reset")}
              onAddExpense={() => dialogs.transaction()}
            />
          )}
        </Suspense>
      </FeatureBoundary>
    </div>
  );
}
