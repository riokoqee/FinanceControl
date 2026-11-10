import type { MessageKey } from "../lib/messages";
import { ArrowDownLeft, Plus, Search } from "lucide-react";
import type { Language } from "../lib/finance";
import { translate } from "../lib/i18n";
import Button from "./Button";

interface Props { language: Language; isFiltered?: boolean; onReset: () => void; onAdd: () => void }
export default function ExpenseEmptyState({ language, isFiltered = false, onReset, onAdd }: Props) {
  const tr = (text: MessageKey) => translate(language, text);
  return (

    <div className="empty-state">
      <span className="empty-icon">
        {isFiltered ? <Search size={25} /> : <ArrowDownLeft size={27} />}
      </span>
      <h3 className="empty-title">
        {isFiltered ? tr("ui.noResultsFound") : tr("ui.noExpensesYet")}
      </h3>
      {isFiltered && (
        <p className="empty-description">
          {tr("ui.tryADifferentTitleOrChangeTheFilters")}
        </p>
      )}
      <div className="empty-actions">
        {isFiltered ? (
          <Button
            onClick={onReset}
          >
            {tr("ui.resetFilters")}
          </Button>
        ) : (
          <Button variant="primary" onClick={onAdd}>
            <Plus size={17} />
            {tr("ui.addExpense")}
          </Button>
        )}
      </div>
    </div>
  );
}
