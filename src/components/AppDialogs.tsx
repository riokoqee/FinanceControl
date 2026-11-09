import { lazy, Suspense } from 'react';
import { Download, Plus, Upload, X } from 'lucide-react';
import type { AppData, CategoryBudget, Currency, Language, Transaction } from '../lib/finance';
import { translate } from '../lib/i18n';
import Button from './Button';
import FeatureBoundary from './FeatureBoundary';
import LoadingState from './LoadingState';
import Modal from './Modal';

const TransactionDialog = lazy(() => import('./TransactionDialog'));
const EntryDetails = lazy(() => import('./EntryDetails'));
const AvatarCropper = lazy(() => import('./AvatarCropper'));
const CategoryBudgetsDialog = lazy(() => import('./CategoryBudgetsDialog'));

export type ConfirmationAction = 'reset' | 'demo' | 'recovery';
export type TransactionModal = 'new' | Transaction | null;
export interface AvatarEditorSource { file?: File; src?: string }

interface AppDialogsProps {
  data: AppData;
  currency: Currency;
  language: Language;
  categoryBudgetsOpen: boolean;
  onCategoryBudgetsClose: () => void;
  onCategoryBudgetsSave: (base: CategoryBudget[], next: CategoryBudget[]) => boolean;
  avatarSource: AvatarEditorSource | null;
  onAvatarClose: () => void;
  onAvatarSave: (avatar: string) => void;
  detailRecord?: Transaction;
  onDetailsClose: () => void;
  onDetailsEdit: () => void;
  onDetailsExport: () => void;
  onDetailsChange: (value: Transaction) => boolean;
  pendingImport: AppData | null;
  onImportClose: () => void;
  onRestoreBackup: (replaceAll: boolean) => void;
  modal: TransactionModal;
  onTransactionClose: () => void;
  onTransactionSave: (value: Transaction) => true | string;
  onTransactionReload: () => void;
  confirmation: ConfirmationAction | null;
  onConfirmationClose: () => void;
  onConfirmationConfirm: () => void;
  onBackupExport: () => void;
}

/** Keep modal presentation together while domain mutations remain in App. */
export default function AppDialogs({
  data, currency, language,
  categoryBudgetsOpen, onCategoryBudgetsClose, onCategoryBudgetsSave,
  avatarSource, onAvatarClose, onAvatarSave,
  detailRecord, onDetailsClose, onDetailsEdit, onDetailsExport, onDetailsChange,
  pendingImport, onImportClose, onRestoreBackup,
  modal, onTransactionClose, onTransactionSave, onTransactionReload,
  confirmation, onConfirmationClose, onConfirmationConfirm, onBackupExport,
}: AppDialogsProps) {
  const tr = (text: string) => translate(language, text);
  return <>
    {categoryBudgetsOpen && (
      <Modal label={tr('Лимиты категорий')} className="category-budgets-modal" onClose={onCategoryBudgetsClose}>
        <FeatureBoundary language={language}>
          <Suspense fallback={<LoadingState />}>
            <CategoryBudgetsDialog
              budgets={data.categoryBudgets ?? []}
              defaultCurrency={currency}
              language={language}
              onSave={onCategoryBudgetsSave}
              onClose={onCategoryBudgetsClose}
            />
          </Suspense>
        </FeatureBoundary>
      </Modal>
    )}
    {avatarSource && (
      <Modal className="avatar-crop-modal" label={tr('Редактор аватара')} onClose={onAvatarClose}>
        <FeatureBoundary language={language}>
          <Suspense fallback={<LoadingState />}>
            <AvatarCropper {...avatarSource} language={language} onSave={onAvatarSave} onClose={onAvatarClose} />
          </Suspense>
        </FeatureBoundary>
      </Modal>
    )}
    {detailRecord && !modal && (
      <Modal className="detail-modal" onClose={onDetailsClose}>
        <FeatureBoundary language={language}>
          <Suspense fallback={<LoadingState />}>
            <EntryDetails
              transaction={detailRecord}
              language={language}
              onClose={onDetailsClose}
              onEdit={onDetailsEdit}
              onExport={onDetailsExport}
              onChange={onDetailsChange}
            />
          </Suspense>
        </FeatureBoundary>
      </Modal>
    )}
    {pendingImport && (
      <Modal onClose={onImportClose}>
        <div className="dialog-header">
          <div><h2>{tr('Копия проверена')}</h2></div>
          <button type="button" className="icon-button" aria-label={tr('Закрыть')} onClick={onImportClose}>
            <X size={20} />
          </button>
        </div>
        <p className="modal-description">
          {tr('Выберите, как восстановить данные. Текущие записи можно объединить с копией.')}
        </p>
        <p className="field-hint">
          {tr('Восстановить всё заменит все данные BeliLog содержимым копии.')}
        </p>
        <div className="import-summary">
          <strong>{pendingImport.transactions.length}</strong>{' '}
          {tr('записей')} · {pendingImport.profile.name}
          {Boolean(pendingImport.shoppingList?.length) && (
            <span>{' '}· {tr('Список покупок')}: {pendingImport.shoppingList!.length}</span>
          )}
          {Boolean(pendingImport.categoryBudgets?.length) && (
            <span>{' '}· {tr('Лимиты')}: {pendingImport.categoryBudgets!.length}</span>
          )}
          {Boolean(pendingImport.shoppingTemplates?.length) && (
            <span>{' '}· {tr('Шаблоны')}: {pendingImport.shoppingTemplates!.length}</span>
          )}
        </div>
        <div className="import-actions">
          <Button onClick={() => onRestoreBackup(false)}>
            <Plus size={16} />{tr('Добавить записи')}
          </Button>
          <Button variant="primary" onClick={() => onRestoreBackup(true)}>
            <Upload size={16} />{tr('Восстановить всё')}
          </Button>
        </div>
        <Button variant="ghost" onClick={onImportClose}>{tr('Отмена')}</Button>
      </Modal>
    )}
    {modal && (
      <Modal onClose={onTransactionClose}>
        <FeatureBoundary language={language}>
          <Suspense fallback={<LoadingState />}>
            <TransactionDialog
              key={modal === 'new' ? 'new' : JSON.stringify(modal)}
              value={modal === 'new' ? null : modal}
              defaultCurrency={currency}
              onClose={onTransactionClose}
              onSave={onTransactionSave}
              onReload={modal === 'new' ? undefined : onTransactionReload}
            />
          </Suspense>
        </FeatureBoundary>
      </Modal>
    )}
    {confirmation && (
      <Modal onClose={onConfirmationClose}>
        <div className="dialog-header">
          <div>
            <h2>{confirmation === 'recovery'
              ? tr('Восстановить последнюю копию?')
              : confirmation === 'reset' ? tr('Начать с чистого листа?') : tr('Загрузить демо?')}</h2>
          </div>
          <button className="icon-button modal-close" onClick={onConfirmationClose} aria-label={tr('Закрыть')}>
            <X size={20} />
          </button>
        </div>
        <p className="modal-description">
          {confirmation === 'recovery'
            ? tr('Повреждённые данные будут сохранены отдельно. Рабочая копия снова станет доступна для изменений.')
            : confirmation === 'reset'
              ? tr('Все данные BeliLog будут удалены из этого браузера. Перед удалением можно скачать резервную копию.')
              : tr('Демо заменит все данные BeliLog. Скачайте копию, чтобы вернуться к своим данным.')}
        </p>
        <div className="confirmation-backup">
          <Button onClick={onBackupExport}><Download size={16} />{tr('Скачать копию перед заменой')}</Button>
        </div>
        <div className="dialog-footer">
          <Button onClick={onConfirmationClose}>{tr('Отмена')}</Button>
          <Button variant={confirmation === 'reset' ? 'danger' : 'primary'} onClick={onConfirmationConfirm}>
            {confirmation === 'recovery'
              ? tr('Восстановить копию')
              : confirmation === 'reset' ? tr('Удалить все данные') : tr('Загрузить демо')}
          </Button>
        </div>
      </Modal>
    )}
  </>;
}
