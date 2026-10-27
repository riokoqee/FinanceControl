import fontkit from '@pdf-lib/fontkit';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream,
  rgb,
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import {
  CATEGORIES,
  convertAmount,
  todayString,
  validateBackup,
} from './finance';
import type { AppData, Currency, Language, Transaction } from './finance';

export interface PdfOptions {
  transactions?: Transaction[];
  title?: string;
  language?: Language;
  currency?: Currency;
  period?: string;
  /** Only explicit backup exports embed the entire profile and transaction history. */
  includeBackup?: boolean;
}

const BACKUP_NAME = 'belilog-backup.json';
const MAX_PDF_SIZE = 40_000_000;
const MAX_BACKUP_SIZE = 30_000_000;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM = 64;
const COLORS = {
  navy: rgb(16 / 255, 29 / 255, 44 / 255),
  gold: rgb(215 / 255, 183 / 255, 119 / 255),
  parchment: rgb(241 / 255, 229 / 255, 203 / 255),
  coral: rgb(195 / 255, 93 / 255, 76 / 255),
  teal: rgb(90 / 255, 156 / 255, 155 / 255),
  muted: rgb(0.37, 0.42, 0.46),
  line: rgb(0.85, 0.87, 0.87),
  white: rgb(1, 1, 1),
};

const COPY = {
  ru: {
    title: 'Журнал расходов',
    created: 'Сформирован',
    period: 'Период',
    allTime: 'За всё время',
    user: 'Пользователь',
    records: 'Записей',
    total: 'Итого',
    original: 'В исходных валютах',
    rates: 'Условный пересчёт: 1 USD = 0,92 EUR = 480 KZT.',
    rateNote: 'Суммы пересчёта приведены для ориентира.',
    note: 'Заметка',
    items: 'Состав покупки',
    itemTotal: 'Распределено по позициям',
    remaining: 'Не распределено',
    excess: 'Превышение суммы записи',
    noItems: 'Позиции покупки не добавлены.',
    empty: 'В выбранном периоде пока нет расходов.',
    backup: 'В PDF вложена полная резервная копия BeliLog для восстановления в профиле.',
    page: 'Страница',
    of: 'из',
    categories: {
      food: 'Еда и продукты', shopping: 'Покупки', transport: 'Транспорт', home: 'Дом',
      entertainment: 'Развлечения', health: 'Здоровье', other: 'Другое',
    },
  },
  en: {
    title: 'Expense journal',
    created: 'Created',
    period: 'Period',
    allTime: 'All time',
    user: 'User',
    records: 'Entries',
    total: 'Total',
    original: 'In original currencies',
    rates: 'Illustrative rates: 1 USD = 0.92 EUR = 480 KZT.',
    rateNote: 'Converted amounts are estimates for reference.',
    note: 'Note',
    items: 'Purchase details',
    itemTotal: 'Item total',
    remaining: 'Unallocated',
    excess: 'Above entry amount',
    noItems: 'No purchase details added.',
    empty: 'No expenses in the selected period yet.',
    backup: 'A full BeliLog backup is attached to this PDF. Restore it from your profile.',
    page: 'Page',
    of: 'of',
    categories: {
      food: 'Food & groceries', shopping: 'Shopping', transport: 'Transport', home: 'Home',
      entertainment: 'Entertainment', health: 'Health', other: 'Other',
    },
  },
};

async function loadFont(): Promise<ArrayBuffer> {
  const baseUrl = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const response = await fetch(`${baseUrl}fonts/report-font.ttf`);
  if (!response.ok) throw new Error('Не удалось загрузить шрифт для PDF. Попробуйте ещё раз.');
  return response.arrayBuffer();
}

function money(amount: number, currency: Currency, language: Language): string {
  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount) + ` ${currency}`;
}

function fullDate(date: string, language: Language): string {
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

/** Build a printable report, optionally including an explicit full-data backup. */
export async function buildPdf(data: AppData, options: PdfOptions = {}): Promise<Uint8Array> {
  const safeData = validateBackup(data);
  const transactions = validateBackup({
    ...safeData, transactions: options.transactions ?? safeData.transactions,
  }).transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
  const language = options.language ?? safeData.profile.language;
  const currency = options.currency ?? safeData.profile.currency;
  const copy = COPY[language];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(await loadFont(), { subset: true });
  const supported = new Set(font.getCharacterSet());
  // Keep the report readable even if a title contains an emoji outside the font.
  const clean = (value: string) => Array.from(value.normalize('NFC'))
    .filter((character) => character === '\n' || character.charCodeAt(0) >= 32)
    .map((character) => character === '\n' || supported.has(character.codePointAt(0)!) ? character : '?')
    .join('');
  const width = (text: string, size: number) => font.widthOfTextAtSize(clean(text), size);
  const draw = (text: string, x: number, y: number, size = 10, color = COLORS.navy) => {
    page.drawText(clean(text), { x, y, size, font, color });
  };

  let page: PDFPage;
  let y = 0;
  function addPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 86, width: PAGE_WIDTH, height: 86, color: COLORS.navy });
    // A small straw hat keeps the printed report in the same visual language as the app.
    page.drawEllipse({ x: MARGIN + 16, y: PAGE_HEIGHT - 45, xScale: 19, yScale: 5, color: COLORS.gold });
    page.drawEllipse({ x: MARGIN + 16, y: PAGE_HEIGHT - 39, xScale: 11, yScale: 10, color: COLORS.gold });
    page.drawRectangle({ x: MARGIN + 5, y: PAGE_HEIGHT - 44, width: 22, height: 4, color: COLORS.coral });
    draw('BeliLog', MARGIN + 49, PAGE_HEIGHT - 40, 21, COLORS.parchment);
    draw('Every Berry Counts.', MARGIN + 50, PAGE_HEIGHT - 59, 9, COLORS.gold);
    y = PAGE_HEIGHT - 112;
  }
  function ensure(height: number) {
    if (y - height < BOTTOM) addPage();
  }
  function wrap(text: string, maxWidth: number, size: number): string[] {
    const lines: string[] = [];
    for (const paragraph of clean(text).split('\n')) {
      if (!paragraph.trim()) { lines.push(''); continue; }
      let current = '';
      for (const word of paragraph.trim().split(/\s+/u)) {
        const joined = current ? `${current} ${word}` : word;
        if (width(joined, size) <= maxWidth) { current = joined; continue; }
        if (current) { lines.push(current); current = ''; }
        // Long unbroken names and links are split by Unicode code point.
        for (const character of Array.from(word)) {
          if (current && width(current + character, size) > maxWidth) {
            lines.push(current);
            current = '';
          }
          current += character;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  function paragraph(text: string, size = 10, color = COLORS.navy, indent = 0, gap = 6) {
    const lineHeight = size * 1.5;
    for (const line of wrap(text, CONTENT_WIDTH - indent, size)) {
      ensure(lineHeight);
      draw(line, MARGIN + indent, y, size, color);
      y -= lineHeight;
    }
    y -= gap;
  }
  function paired(label: string, value: string, size = 10, indent = 0, color = COLORS.navy) {
    const valueWidth = width(value, size);
    const labelWidth = CONTENT_WIDTH - indent - valueWidth - 20;
    // Normally amounts stay on the right; exceptionally wide values get their own line.
    if (labelWidth < 90) {
      paragraph(label, size, color, indent, 0);
      paragraph(value, size, color, indent, 4);
      return;
    }
    const lines = wrap(label, labelWidth, size);
    ensure(size * 1.5);
    draw(value, PAGE_WIDTH - MARGIN - valueWidth, y, size, color);
    for (const line of lines) {
      ensure(size * 1.5);
      draw(line, MARGIN + indent, y, size, color);
      y -= size * 1.5;
    }
    y -= 4;
  }
  function divider() {
    ensure(18);
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.6, color: COLORS.line });
    y -= 17;
  }

  const now = todayString();
  const reportTitle = options.title?.trim() || copy.title;
  doc.setTitle(`BeliLog — ${reportTitle}`);
  doc.setAuthor(safeData.profile.name);
  doc.setCreator('BeliLog');
  doc.setProducer('BeliLog / pdf-lib');
  doc.setSubject('Every Berry Counts.');
  addPage();
  paragraph(reportTitle, 21, COLORS.navy, 0, 9);
  paragraph(`${copy.user}: ${safeData.profile.name}`, 10, COLORS.muted, 0, 1);
  paragraph(`${copy.created}: ${fullDate(now, language)}`, 10, COLORS.muted, 0, 1);
  paragraph(`${copy.period}: ${options.period || copy.allTime}`, 10, COLORS.muted, 0, 1);
  paragraph(`${copy.records}: ${transactions.length}`, 10, COLORS.muted, 0, 12);

  const total = transactions.reduce((sum, transaction) => sum + convertAmount(transaction.amount, transaction.currency, currency), 0);
  paired(copy.total, money(total, currency, language), 17);
  paragraph(copy.original, 9, COLORS.muted, 0, 2);
  for (const originalCurrency of ['USD', 'EUR', 'KZT'] as const) {
    const originalTransactions = transactions.filter((transaction) => transaction.currency === originalCurrency);
    if (originalTransactions.length) {
      paired(originalCurrency, money(originalTransactions.reduce((sum, transaction) => sum + transaction.amount, 0), originalCurrency, language), 10);
    }
  }
  paragraph(`${copy.rates} ${copy.rateNote}`, 8, COLORS.muted, 0, 7);
  divider();

  if (!transactions.length) paragraph(copy.empty, 11, COLORS.muted, 0, 15);
  transactions.forEach((transaction, index) => {
    ensure(75);
    paragraph(`${String(index + 1).padStart(2, '0')}  ·  ${fullDate(transaction.date, language)}  ·  ${copy.categories[transaction.category] ?? CATEGORIES.find((category) => category.id === transaction.category)!.label}`, 9, COLORS.muted, 0, 4);
    paired(transaction.title, money(transaction.amount, transaction.currency, language), 12);
    if (transaction.note) paragraph(`${copy.note}: ${transaction.note}`, 9, COLORS.muted, 8, 5);
    if (transaction.items?.length) {
      paragraph(copy.items, 9, COLORS.teal, 8, 3);
      for (const item of transaction.items) {
        paired(`• ${item.title}`, money(item.amount, transaction.currency, language), 9, 14);
      }
      const itemTotal = transaction.items.reduce((sum, item) => sum + item.amount, 0);
      const remaining = transaction.amount - itemTotal;
      paired(copy.itemTotal, money(itemTotal, transaction.currency, language), 9, 8, COLORS.muted);
      paired(remaining < -0.005 ? copy.excess : copy.remaining, money(Math.abs(remaining) < 0.005 ? 0 : Math.abs(remaining), transaction.currency, language), 9, 8, remaining < -0.005 ? COLORS.coral : COLORS.muted);
    } else {
      paragraph(copy.noItems, 8, COLORS.muted, 8, 3);
    }
    y -= 4;
    divider();
  });
  if (options.includeBackup) paragraph(copy.backup, 8, COLORS.muted);

  const pages = doc.getPages();
  pages.forEach((reportPage, index) => {
    reportPage.drawLine({ start: { x: MARGIN, y: 45 }, end: { x: PAGE_WIDTH - MARGIN, y: 45 }, thickness: 0.5, color: COLORS.line });
    reportPage.drawText('BeliLog · Every Berry Counts.', { x: MARGIN, y: 29, size: 8, font, color: COLORS.muted });
    const pageNumber = `${copy.page} ${index + 1} ${copy.of} ${pages.length}`;
    reportPage.drawText(pageNumber, { x: PAGE_WIDTH - MARGIN - width(pageNumber, 8), y: 29, size: 8, font, color: COLORS.muted });
  });
  if (options.includeBackup) {
    await doc.attach(new TextEncoder().encode(JSON.stringify(safeData)), BACKUP_NAME, {
      mimeType: 'application/json', description: 'BeliLog complete backup',
      creationDate: new Date(), modificationDate: new Date(),
    });
  }
  return doc.save();
}

/** Download a real PDF; it does not depend on the browser print dialog. */
export async function exportPdf(data: AppData, options: PdfOptions = {}): Promise<void> {
  const bytes = await buildPdf(data, options);
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `belilog-${todayString()}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the browser begin consuming the blob before releasing its URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function attachmentName(value: unknown): string | undefined {
  return value instanceof PDFString || value instanceof PDFHexString ? value.decodeText() : undefined;
}

/** Read only our named attachment; PDF scripts and page contents are never executed. */
export async function readPdfBackup(bytes: Uint8Array): Promise<AppData> {
  if (bytes.byteLength > MAX_PDF_SIZE) throw new Error('PDF слишком большой. Максимум — 40 МБ.');
  if (new TextDecoder('ascii').decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('Выберите PDF, сохранённый из BeliLog.');
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
  } catch {
    throw new Error('Не удалось прочитать PDF. Выберите резервную копию BeliLog.');
  }
  const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const embeddedFiles = names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  if (!embeddedFiles) throw new Error('В этом PDF нет резервной копии BeliLog.');
  const visited = new Set<PDFDict>();
  // PDF name trees can use either a direct Names array or nested Kids dictionaries.
  function find(tree: PDFDict, depth = 0): PDFDict | undefined {
    if (depth > 20 || visited.has(tree)) throw new Error('Некорректное дерево вложений PDF.');
    visited.add(tree);
    const entries = tree.lookupMaybe(PDFName.of('Names'), PDFArray);
    if (entries) {
      for (let index = 0; index + 1 < entries.size(); index += 2) {
        if (attachmentName(doc.context.lookup(entries.get(index))) === BACKUP_NAME) {
          return entries.lookup(index + 1, PDFDict);
        }
      }
    }
    const kids = tree.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (kids) for (let index = 0; index < kids.size(); index++) {
      const result = find(kids.lookup(index, PDFDict), depth + 1);
      if (result) return result;
    }
    return undefined;
  }
  const attachment = find(embeddedFiles);
  const files = attachment?.lookupMaybe(PDFName.of('EF'), PDFDict);
  const unicodeStream = files ? doc.context.lookup(files.get(PDFName.of('UF'))) : undefined;
  const fallbackStream = files ? doc.context.lookup(files.get(PDFName.of('F'))) : undefined;
  const stream = unicodeStream instanceof PDFRawStream ? unicodeStream : fallbackStream;
  if (!(stream instanceof PDFRawStream)) throw new Error('В этом PDF нет резервной копии BeliLog.');
  let payload: Uint8Array;
  try {
    // Read a bounded amount instead of expanding an arbitrary attachment in full.
    payload = new Uint8Array(decodePDFRawStream(stream).getBytes(MAX_BACKUP_SIZE + 1));
  } catch {
    throw new Error('Вложенная резервная копия PDF повреждена.');
  }
  if (payload.byteLength > MAX_BACKUP_SIZE) throw new Error('Вложенная резервная копия слишком большая.');
  return validateBackup(new TextDecoder('utf-8', { fatal: true }).decode(payload));
}
