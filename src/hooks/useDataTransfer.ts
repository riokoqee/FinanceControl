import { useCallback, useEffect, useRef, useState } from 'react';
import { todayString } from '../lib/finance';
import type { AppData, Language, Transaction } from '../lib/finance';
import {
  MAX_IMPORT_FILE_BYTES,
  buildExpensesCsv,
  buildJsonBackup,
  downloadFile,
  readBackupFile,
} from '../lib/dataExport';

const copy = {
  ru: {
    pdfBackup: 'PDF-копия со всеми данными',
    report: 'Журнал расходов',
    allTime: 'За всё время',
    backupSaved: 'Резервная копия скачана',
    pdfSaved: 'PDF-отчёт скачан',
    csvSaved: 'CSV скачан',
    pdfFailed: 'Не удалось создать PDF. Попробуйте ещё раз.',
    exportFailed: 'Не удалось скачать файл. Попробуйте ещё раз.',
    tooLarge: 'Файл слишком большой. Максимум — 40 МБ.',
    importFailed: 'Выберите PDF-копию BeliLog или JSON-файл.',
  },
  en: {
    pdfBackup: 'PDF backup with all your data',
    report: 'Expense journal',
    allTime: 'All time',
    backupSaved: 'Backup downloaded',
    pdfSaved: 'PDF report downloaded',
    csvSaved: 'CSV downloaded',
    pdfFailed: 'Unable to create the PDF. Please try again.',
    exportFailed: 'Could not download the file. Please try again.',
    tooLarge: 'The file is too large. Maximum size: 40 MB.',
    importFailed: 'Choose a BeliLog PDF backup or a JSON file.',
  },
};

interface DataTransferOptions {
  data: AppData;
  language: Language;
  month: string;
  allTime: boolean;
  onToast: (toast: { message: string; error?: boolean }) => void;
  onImport: (data: AppData) => void;
}

/** Reports receive records at click time, including any pending search query. */
export function useDataTransfer(options: DataTransferOptions) {
  const latest = useRef(options);
  latest.current = options;
  const [pdfBusy, setPdfBusy] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const importRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; importRequest.current += 1; };
  }, []);

  const exportPdf = useCallback(async (records: Transaction[], backup = false): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    setPdfBusy(true);
    const { data, language, month, allTime, onToast } = latest.current;
    const t = copy[language];
    try {
      const { exportPdf: savePdf } = await import('../lib/pdf');
      await savePdf(data, {
        transactions: records,
        language,
        currency: data.profile.currency,
        title: backup ? t.pdfBackup : t.report,
        period: backup || allTime ? t.allTime : new Date(`${month}-01T12:00:00`).toLocaleDateString(
          language === 'en' ? 'en-US' : 'ru-RU', { month: 'long', year: 'numeric' },
        ).replace(' г.', ''),
        includeBackup: backup,
      });
      if (mounted.current) onToast({ message: backup ? t.backupSaved : t.pdfSaved });
    } catch {
      if (mounted.current) onToast({ message: t.pdfFailed, error: true });
    } finally {
      busy.current = false;
      if (mounted.current) setPdfBusy(false);
    }
  }, []);

  const exportJson = useCallback((): void => {
    const { data, language, onToast } = latest.current;
    const t = copy[language];
    try {
      downloadFile(new Blob([buildJsonBackup(data)], { type: 'application/json;charset=utf-8' }), `belilog-backup-${todayString()}.json`);
      onToast({ message: t.backupSaved });
    } catch { onToast({ message: t.exportFailed, error: true }); }
  }, []);

  const exportCsv = useCallback((records: readonly Transaction[]): void => {
    const { language, onToast } = latest.current;
    const t = copy[language];
    try {
      downloadFile(new Blob([buildExpensesCsv(records)], { type: 'text/csv;charset=utf-8' }), `belilog-expenses-${todayString()}.csv`);
      onToast({ message: t.csvSaved });
    } catch { onToast({ message: t.exportFailed, error: true }); }
  }, []);

  const importBackup = useCallback(async (file?: File): Promise<void> => {
    if (!file) return;
    const request = ++importRequest.current;
    const { language, onToast, onImport } = latest.current;
    const t = copy[language];
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      onToast({ message: t.tooLarge, error: true });
      return;
    }
    try {
      const incoming = await readBackupFile(file);
      if (mounted.current && request === importRequest.current) onImport(incoming);
    } catch {
      if (mounted.current && request === importRequest.current) onToast({ message: t.importFailed, error: true });
    }
  }, []);

  return { pdfBusy, exportPdf, exportJson, exportCsv, importBackup };
}
