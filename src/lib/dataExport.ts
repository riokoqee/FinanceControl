import { MAX_BACKUP_LENGTH, createEmptyData, validateBackup } from './finance';
import type { AppData, Transaction } from './finance';

export const MAX_IMPORT_FILE_BYTES = 40 * 1024 * 1024;

/** Text cells must remain text when a spreadsheet opens a CSV automatically. */
function csvText(value: string): string {
  const dangerous = /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(value) || /^[\t\r\n]/u.test(value);
  const text = dangerous ? `'${value}` : value;
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Expand small legacy values without rounding them or emitting exponents. */
function decimalAmount(amount: number): string {
  const value = String(amount);
  if (!/[eE]/u.test(value)) return value;
  const [coefficient, exponentText] = value.toLowerCase().split('e');
  const [whole, fraction = ''] = coefficient.split('.');
  const digits = `${whole}${fraction}`;
  const position = whole.length + Number(exponentText);
  if (position <= 0) return `0.${'0'.repeat(-position)}${digits}`;
  if (position >= digits.length) return `${digits}${'0'.repeat(position - digits.length)}`;
  return `${digits.slice(0, position)}.${digits.slice(position)}`;
}

/**
 * A portable expense table in original currencies. Purchase details stay in one
 * JSON cell, so one parent expense always remains one row without double totals.
 */
export function buildExpensesCsv(records: readonly Transaction[]): string {
  // Validate before exporting, while retaining the caller's exact text below.
  validateBackup({ ...createEmptyData(), transactions: records });
  const rows = ['id,date,created_at,title,category,amount,currency,note,items'];
  for (const record of records) {
    rows.push([
      csvText(record.id),
      record.date,
      record.createdAt ?? '',
      csvText(record.title),
      record.category,
      decimalAmount(record.amount),
      record.currency,
      csvText(record.note ?? ''),
      csvText(record.items === undefined ? '' : JSON.stringify(record.items)),
    ].join(','));
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

/** Full, validated app data; this is a restorable backup rather than a report. */
export function buildJsonBackup(data: AppData): string {
  const canonical = validateBackup(data);
  const pretty = `${JSON.stringify(canonical, null, 2)}\n`;
  if (pretty.length <= MAX_BACKUP_LENGTH) return pretty;
  // Formatting must not make an otherwise readable large backup unimportable.
  const compact = JSON.stringify(canonical);
  if (compact.length > MAX_BACKUP_LENGTH) throw new Error('Backup exceeds the readable size limit.');
  return compact;
}

/** PDF parsing remains deferred until a PDF signature is actually encountered. */
export async function readBackupFile(file: Pick<File, 'size' | 'arrayBuffer'>): Promise<AppData> {
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error('Backup file exceeds the 40 MiB limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder('ascii').decode(bytes.subarray(0, 5)) === '%PDF-') {
    return (await import('./pdf')).readPdfBackup(bytes);
  }
  return validateBackup(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

/** Remove temporary elements even on failure and release object URLs after use. */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link?.remove();
    // Let the browser begin consuming the blob before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
