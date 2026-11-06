import { useI18n } from '../lib/i18n';

export default function LoadingState() {
  const { tr } = useI18n();
  return <div className="loading-state" role="status" aria-live="polite">{tr('Загрузка…')}</div>;
}
