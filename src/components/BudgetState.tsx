import { message } from "../lib/messages";
import { CheckCircle2, CircleAlert, TriangleAlert } from 'lucide-react';
import type { Language } from '../lib/finance';

/** A visible symbol and label supplement the existing calculated limit state. */
export default function BudgetState({ state, language, reached = false }: {
  state: 'normal' | 'warning' | 'over'; language: Language; reached?: boolean;
}) {
  const Icon = state === 'over' ? CircleAlert : state === 'warning' ? TriangleAlert : CheckCircle2;
  const label = reached ? (message(language, "ui.limitReached")) :
    state === 'over' ? (message(language, "ui.overLimit")) :
    state === 'warning' ? (message(language, "ui.nearLimit")) :
    (message(language, "ui.onTrack"));
  return <span className={`budget-state budget-state--${state}`}>
    <Icon size={14} aria-hidden="true" /><span>{label}</span>
  </span>;
}
