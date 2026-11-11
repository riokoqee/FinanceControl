import { CURRENT_APP_DATA_VERSION } from "./appDataVersion";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyData, validateBackup } from "./finance";
import type { AppData, Transaction } from "./finance";
import {
  MAX_IMPORT_FILE_BYTES,
  buildExpensesCsv,
  buildJsonBackup,
  downloadFile,
  readBackupFile,
} from "./dataExport";

const pdfReader = vi.hoisted(() => vi.fn());
vi.mock("./pdf", () => ({ readPdfBackup: pdfReader }));

const expense = (patch: Partial<Transaction> = {}): Transaction => ({
  id: "groceries",
  title: "Groceries",
  amount: 12.5,
  currency: "EUR",
  category: "food",
  date: "2026-11-09",
  createdAt: "2026-11-09",
  ...patch,
});
const header = "id,date,created_at,title,category,amount,currency,note,items";

/** Read RFC 4180 cells independently to assert spreadsheet-visible values. */
function cells(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = csv.replace(/^\uFEFF/u, "");
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index++;
      } else quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
    } else if (!quoted && char === "\r" && text[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index++;
    } else cell += char;
  }
  return rows;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("portable expense CSV", () => {
  it("uses a UTF-8 BOM, stable headers, CRLF records and a valid empty table", () => {
    expect(buildExpensesCsv([])).toBe(`\uFEFF${header}\r\n`);
    expect(cells(buildExpensesCsv([]))).toEqual([header.split(",")]);
  });

  it("escapes commas, quotes and multiline notes while retaining exact original text", () => {
    const record = expense({
      title: 'Milk, "fresh"',
      note: "Line 1\r\nLine 2",
      items: [{ id: "milk", title: 'Milk "fresh"', amount: 2 }],
    });
    const before = structuredClone(record);
    const csv = buildExpensesCsv([record]);
    expect(csv).toContain('"Milk, ""fresh"""');
    expect(csv).toContain('"Line 1\r\nLine 2"');
    const rows = cells(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      record.id,
      record.date,
      record.createdAt,
      record.title,
      record.category,
      "12.5",
      record.currency,
      record.note,
      JSON.stringify(record.items),
    ]);
    expect(record).toEqual(before);
  });

  it("keeps one row per expense, original currencies and raw decimal amounts", () => {
    const records = [
      expense({ id: "usd", amount: 10, currency: "USD" }),
      expense({ id: "eur", amount: 9.2, currency: "EUR" }),
      expense({
        id: "kzt",
        amount: 4800,
        currency: "KZT",
        createdAt: undefined,
      }),
    ];
    const rows = cells(buildExpensesCsv(records));
    expect(rows).toHaveLength(4);
    expect(rows.slice(1).map((row) => row.slice(5, 7))).toEqual([
      ["10", "USD"],
      ["9.2", "EUR"],
      ["4800", "KZT"],
    ]);
    expect(rows[3][2]).toBe("");
  });

  it("does not round a small legacy amount into zero or scientific notation", () => {
    expect(
      cells(buildExpensesCsv([expense({ amount: 0.0000001 })]))[1][5],
    ).toBe("0.0000001");
  });

  it.each([
    "=SUM(1,2)",
    "+cmd",
    "-1+2",
    "@SUM(1)",
    "\t=SUM(1)",
    "\r=1+1",
    "\n+1+1",
    "  =1+1",
    "\u00a0@SUM(1)",
    "\t\r  -2+3",
    "\u0000+1+1",
  ])("neutralizes a spreadsheet formula beginning %j", (payload) => {
    const row = cells(
      buildExpensesCsv([
        expense({ id: payload, title: payload, note: payload }),
      ]),
    )[1];
    expect(row[0]).toBe(`'${payload}`);
    expect(row[3]).toBe(`'${payload}`);
    expect(row[7]).toBe(`'${payload}`);
    expect(row[5]).toBe("12.5");
  });

  it("leaves ordinary words and embedded mathematical symbols unchanged", () => {
    const row = cells(
      buildExpensesCsv([
        expense({ title: "Tea + milk", note: "Paid @ café = 12.5" }),
      ]),
    )[1];
    expect(row[3]).toBe("Tea + milk");
    expect(row[7]).toBe("Paid @ café = 12.5");
  });

  it("keeps formula-like purchase names as inert JSON inside one details cell", () => {
    const items = [
      { id: "one", title: "=SUM(1,2)", amount: 2 },
      { id: "two", title: "Филе", amount: 9 },
    ];
    const rows = cells(buildExpensesCsv([expense({ items })]));
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[1][8])).toEqual(items);
    expect(rows[1][5]).toBe("12.5");
  });

  it("rejects invalid financial data instead of emitting a misleading CSV", () => {
    expect(() => buildExpensesCsv([expense({ amount: NaN })])).toThrow();
    expect(() => buildExpensesCsv([expense({ amount: 0 })])).toThrow();
    expect(() => buildExpensesCsv([expense({ date: "2026-02-30" })])).toThrow();
  });
});

describe("restorable JSON and PDF import", () => {
  const fullData = (): AppData => ({
    ...createEmptyData(),
    version: 3,
    profile: {
      ...createEmptyData().profile,
      name: "Аскар",
      avatar: "data:image/png;base64,iVBORw0KGgo=",
    },
    transactions: [
      expense({ items: [{ id: "bread", title: "Батон", amount: 2 }] }),
    ],
    shoppingList: [
      { id: "milk", title: "Молоко", currency: "KZT", createdAt: "2026-11-09" },
    ],
    categoryBudgets: [{ id: "food", amount: 200, currency: "EUR" }],
    shoppingTemplates: [
      {
        id: "weekly",
        name: "На неделю",
        items: [{ title: "Хлеб", currency: "EUR" }],
      },
    ],
    streak: {
      version: 1,
      startedOn: "2026-11-09",
      confirmedDays: [{ date: "2026-11-09", status: "NO_SPEND" }],
    },
  });
  const file = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    return {
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.buffer as ArrayBuffer,
    };
  };

  it("exports a full validated backup including profile, purchase details, planning and check-ins", () => {
    const data = fullData();
    const source = structuredClone(data);
    expect(validateBackup(buildJsonBackup(data))).toEqual(data);
    expect(data).toEqual(source);
    expect(buildJsonBackup(createEmptyData())).not.toContain('"streak"');
  });

  it("strips unknown properties and rejects unsupported versions on JSON export", () => {
    expect(
      JSON.parse(
        buildJsonBackup({ ...fullData(), arbitrary: "discarded" } as AppData),
      ),
    ).not.toHaveProperty("arbitrary");
    expect(() =>
      buildJsonBackup({
        ...fullData(),
        version: CURRENT_APP_DATA_VERSION + 1,
      } as unknown as AppData),
    ).toThrow();
  });

  it("imports current and legacy JSON without invoking PDF parsing, including a UTF-8 BOM", async () => {
    const data = fullData();
    expect(
      await readBackupFile(file(`\uFEFF${buildJsonBackup(data)}`)),
    ).toEqual(data);
    expect(
      await readBackupFile(file(buildJsonBackup(createEmptyData()))),
    ).toEqual(createEmptyData());
    expect(pdfReader).not.toHaveBeenCalled();
  });

  it("rejects oversized files before reading bytes", async () => {
    const arrayBuffer = vi.fn();
    await expect(
      readBackupFile({ size: MAX_IMPORT_FILE_BYTES + 1, arrayBuffer }),
    ).rejects.toThrow("40");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON, invalid schema and malformed UTF-8", async () => {
    await expect(readBackupFile(file("{broken"))).rejects.toThrow();
    await expect(readBackupFile(file('{"version":99}'))).rejects.toThrow();
    await expect(
      readBackupFile({
        size: 2,
        arrayBuffer: async () => Uint8Array.of(0xc3, 0x28).buffer,
      }),
    ).rejects.toThrow();
  });

  it("routes PDF signatures to the existing deferred PDF backup reader", async () => {
    const data = fullData();
    pdfReader.mockResolvedValueOnce(data);
    const pdf = file("%PDF-sample");
    expect(await readBackupFile(pdf)).toEqual(data);
    expect(pdfReader).toHaveBeenCalledOnce();
    expect(new TextDecoder().decode(pdfReader.mock.calls[0][0])).toBe(
      "%PDF-sample",
    );
  });
});

describe("download cleanup", () => {
  it.each([false, true])(
    "removes the temporary link and eventually releases its URL (click failure: %s)",
    (failClick) => {
      vi.useFakeTimers();
      const link = {
        href: "",
        download: "",
        click: vi.fn(() => {
          if (failClick) throw new Error("Download blocked");
        }),
        remove: vi.fn(),
      };
      const append = vi.fn();
      const createObjectURL = vi.fn(() => "blob:test-download");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("document", {
        createElement: vi.fn(() => link),
        body: { append },
      });
      vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
      const blob = new Blob(["test"], { type: "text/plain" });
      if (failClick)
        expect(() => downloadFile(blob, "belilog.csv")).toThrow(
          "Download blocked",
        );
      else downloadFile(blob, "belilog.csv");
      expect(link.href).toBe("blob:test-download");
      expect(link.download).toBe("belilog.csv");
      expect(append).toHaveBeenCalledWith(link);
      expect(link.remove).toHaveBeenCalledOnce();
      expect(revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60_000);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-download");
    },
  );
});
