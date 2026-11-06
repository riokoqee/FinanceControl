import { Component } from 'react';
import type { ReactNode } from 'react';
import { translate } from '../lib/i18n';
import type { Language } from '../lib/finance';

/** A failed optional chunk keeps navigation and the stored journal available. */
export default class FeatureBoundary extends Component<{ language: Language; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    const tr = (text: string) => translate(this.props.language, text);
    return <div className="loading-state" role="alert">
      <p>{tr('Не удалось загрузить раздел. Проверьте соединение и обновите страницу.')}</p>
      <button type="button" className="button button-secondary" onClick={() => window.location.reload()}>{tr('Обновить страницу')}</button>
    </div>;
  }
}
