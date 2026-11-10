import AppDialogs from "./components/AppDialogs";
import AppShell from "./components/AppShell";
import AppToast from "./components/AppToast";
import AppWorkspace from "./components/AppWorkspace";
import StorageWarning from "./components/StorageWarning";
import { useAppData } from "./hooks/useAppData";
import { useAppFeedback } from "./hooks/useAppFeedback";
import { useBackupRestore } from "./hooks/useBackupRestore";
import { useDialogState } from "./hooks/useDialogState";
import { useExpenseView } from "./hooks/useExpenseView";
import { useHashPage } from "./hooks/useHashPage";
import { useProfileSettings } from "./hooks/useProfileSettings";
import { useShoppingActions } from "./hooks/useShoppingActions";
import { useShoppingTemplates } from "./hooks/useShoppingTemplates";
import { useStreakStats } from "./hooks/useStreakStats";
import { useTrackingActions } from "./hooks/useTrackingActions";
import { useTransactions } from "./hooks/useTransactions";
import { LanguageProvider } from "./lib/i18n";

/** Compose independent data, route and feature controllers at the application boundary. */
export default function App() {
  const store = useAppData();
  const { data, storageOk, status, error } = store;
  const { page, navigate, beforeChange } = useHashPage();
  const streak = useStreakStats(data.transactions, data.streak);
  const feedback = useAppFeedback(page, streak, error);
  const dialogs = useDialogState();
  const view = useExpenseView(data, page);
  const profile = useProfileSettings(store, page, dialogs, feedback);
  beforeChange.current = profile.flushProfile;
  const transactions = useTransactions({
    store,
    dialogs,
    feedback,
    page,
    setMonth: view.setMonth,
  });
  const tracking = useTrackingActions(store, feedback, page);
  const shopping = useShoppingActions({
    operateData: store.operateData,
    page,
    language: data.profile.language,
    setToast: feedback.setToast,
    setBountyCelebration: feedback.setCelebration,
  });
  const templates = useShoppingTemplates(store, feedback);
  const backup = useBackupRestore({ store, dialogs, feedback, profile, view });

  return (
    <LanguageProvider language={data.profile.language}>
      <AppShell
        data={data}
        page={page}
        storageOk={storageOk}
        initials={profile.initials}
        onNavigate={navigate}
        onToggleTheme={profile.toggleTheme}
        overlays={
          <>
            <AppDialogs
              data={data}
              dialogs={dialogs}
              transactions={transactions}
              profile={profile}
              backup={backup}
            />
            {feedback.toast && (
              <AppToast
                toast={feedback.toast}
                language={data.profile.language}
                onDismiss={() => feedback.setToast(null)}
              />
            )}
          </>
        }
      >
        {!storageOk && (
          <StorageWarning
            status={status}
            error={error}
            language={data.profile.language}
            onExport={backup.exportBackup}
            onConfirm={dialogs.confirm}
            onNavigate={navigate}
          />
        )}
        <AppWorkspace
          data={data}
          page={page}
          storageOk={storageOk}
          storageError={error}
          streakCurrent={streak.current}
          navigate={navigate}
          view={view}
          settings={profile}
          transactions={transactions}
          shopping={shopping}
          templates={templates}
          tracking={tracking}
          backup={backup}
          dialogs={dialogs}
          feedback={feedback}
        />
      </AppShell>
    </LanguageProvider>
  );
}
