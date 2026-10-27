import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createEmptyData } from './finance';
import type { AppData } from './finance';
import { buildPdf, readPdfBackup } from './pdf';

const fontBytes = readFileSync(new URL('../../public/fonts/report-font.ttf', import.meta.url));
const data: AppData = {
  ...createEmptyData(),
  profile: {
    ...createEmptyData().profile, name: 'Аскар', currency: 'EUR', language: 'ru',
    avatar: 'data:image/png;base64,iVBORw0KGgo=',
  },
  transactions: [
    {
      id: 'groceries', title: 'Еда и продукты', amount: 50, currency: 'EUR',
      category: 'food', date: '2026-10-27', createdAt: '2026-10-27',
      note: 'Покупки на неделю',
      items: [
        { id: 'bread', title: 'Батон', amount: 2 },
        { id: 'chicken', title: 'Филе', amount: 9 },
      ],
    },
    { id: 'taxi', title: 'Такси', amount: 3200, currency: 'KZT', category: 'transport', date: '2026-10-26' },
    { id: 'book', title: 'Book', amount: 12, currency: 'USD', category: 'other', date: '2026-10-25' },
  ],
};
let report: Uint8Array;

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength),
  })));
  report = await buildPdf(data, { transactions: [data.transactions[0]], period: 'Октябрь 2026', includeBackup: true });
}, 30_000);

afterAll(() => vi.unstubAllGlobals());

describe('BeliLog PDF reports', () => {
  it('creates an actual A4 PDF with embedded Unicode text and a BeliLog title', async () => {
    expect(new TextDecoder().decode(report.subarray(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(report);
    expect(doc.getTitle()).toBe('BeliLog — Журнал расходов');
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28);
    const streams = doc.context.enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((object): object is PDFRawStream => object instanceof PDFRawStream)
      .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()));
    // A ToUnicode map allows a PDF reader to select/copy the Cyrillic text.
    expect(streams.some((stream) => stream.includes('beginbfchar') && /<04[0-9A-F]{2}>/i.test(stream))).toBe(true);
  });

  it('restores the full profile and all entries even when the visible report is filtered', async () => {
    const restored = await readPdfBackup(report);
    expect(restored).toEqual(data);
    expect(restored.transactions).toHaveLength(3);
    expect(restored.transactions[0].items?.[1]).toEqual({ id: 'chicken', title: 'Филе', amount: 9 });
  });

  it('paginates long notes, unbroken names and many purchase items', async () => {
    const longEntry = {
      ...data.transactions[0],
      title: 'ОченьДлинноеНазвание'.repeat(8),
      note: 'Подробная заметка о покупке. '.repeat(65),
      items: Array.from({ length: 100 }, (_, index) => ({
        id: `item-${index}`, title: `Позиция ${index + 1}: ${'ДлинноеНазвание'.repeat(8)}`, amount: 0.25,
      })),
    };
    const longReport = await buildPdf({ ...data, transactions: [longEntry] }, { includeBackup: true });
    expect((await PDFDocument.load(longReport)).getPageCount()).toBeGreaterThan(3);
    expect((await readPdfBackup(longReport)).transactions[0].items).toHaveLength(100);
  }, 30_000);

  it('supports English, all three currency symbols, and an empty report', async () => {
    const english = await buildPdf(data, { language: 'en', currency: 'KZT' });
    const doc = await PDFDocument.load(english);
    expect(doc.getTitle()).toBe('BeliLog — Expense journal');
    const empty = await buildPdf(createEmptyData(), { language: 'en', includeBackup: true });
    expect((await PDFDocument.load(empty)).getPageCount()).toBe(1);
    expect((await readPdfBackup(empty)).transactions).toEqual([]);
  }, 30_000);

  it('reads a valid attachment from a nested PDF name tree', async () => {
    const doc = await PDFDocument.load(report);
    const names = doc.catalog.lookup(PDFName.of('Names'), PDFDict);
    const tree = names.lookup(PDFName.of('EmbeddedFiles'), PDFDict);
    const entries = tree.lookup(PDFName.of('Names'), PDFArray);
    const child = doc.context.obj({ Names: entries });
    tree.delete(PDFName.of('Names'));
    tree.set(PDFName.of('Kids'), doc.context.obj([doc.context.register(child)]));
    expect(await readPdfBackup(await doc.save())).toEqual(data);
  });

  it('keeps ordinary filtered reports free of unrelated profile and history attachments', async () => {
    const filtered = await buildPdf(data, { transactions: [data.transactions[0]] });
    const doc = await PDFDocument.load(filtered);
    const names = doc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    expect(names?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict)).toBeUndefined();
    await expect(readPdfBackup(filtered)).rejects.toThrow('резервной копии');
  });

  it('rejects ordinary PDFs, malformed files and invalid attached data', async () => {
    const ordinary = await PDFDocument.create();
    ordinary.addPage();
    await expect(readPdfBackup(await ordinary.save())).rejects.toThrow('резервной копии');
    await expect(readPdfBackup(new TextEncoder().encode('not a PDF'))).rejects.toThrow('PDF');
    const badBackup = await PDFDocument.create();
    badBackup.addPage();
    await badBackup.attach(new TextEncoder().encode('{"version":9}'), 'belilog-backup.json');
    await expect(readPdfBackup(await badBackup.save())).rejects.toThrow('формат');
  });
});
