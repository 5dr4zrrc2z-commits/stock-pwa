import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import {
  rate,
  valuation,
  periodRates,
  aggregate,
  importCSV,
  restore,
  save,
  load,
  empty,
  analysisCSV,
  demoData,
  type Stock,
} from "./data";
const stock: Stock = {
  id: "JP:TEST",
  code: "TEST",
  name: "架空銘柄",
  market: "JP",
  watch: true,
  shares: 100,
  cost: 1000,
};
describe("計算", () => {
  it("上昇・下落・ゼロ基準・データ不足", () => {
    expect(rate(100, 110)).toBeCloseTo(10);
    expect(rate(100, 80)).toBeCloseTo(-20);
    expect(rate(0, 10)).toBeNull();
    expect(rate(undefined, 100)).toBeNull();
  });
  it("評価額と評価損益", () => {
    expect(valuation(stock, 1200)).toEqual({ value: 120000, profit: 20000 });
    expect(valuation(stock, 800).profit).toBe(-20000);
    expect(valuation(stock)).toEqual({ value: null, profit: null });
  });
  it("月間・年間は最終終値で計算、入力順に依存しない", () => {
    const p = [
      { stockId: stock.id, date: "2026-02-02", close: 132 },
      { stockId: stock.id, date: "2025-12-30", close: 100 },
      { stockId: stock.id, date: "2026-01-05", close: 105 },
      { stockId: stock.id, date: "2026-01-30", close: 120 },
    ];
    expect(periodRates(p, "month").map((r) => r.rate)).toEqual([
      null,
      expect.closeTo(20),
      expect.closeTo(10),
    ]);
    expect(periodRates(p, "year")[1].rate).toBeCloseTo(32);
    expect(aggregate(p, "月足")).toHaveLength(3);
  });
  it("週の境界は月曜日、年またぎにも対応", () => {
    const p = ["2025-12-28", "2025-12-29", "2026-01-02", "2026-01-05"].map(
      (date, i) => ({ stockId: stock.id, date, close: i + 1 }),
    );
    expect(aggregate(p, "週足").map((p) => p.date)).toEqual([
      "2025-12-28",
      "2026-01-02",
      "2026-01-05",
    ]);
  });
});
describe("CSV・保存・復元", () => {
  const csv =
    '\uFEFF日付,銘柄コード,銘柄名,終値\r\n2026-01-05,TEST,"架空,銘柄",100\r\n2026-02-05,TEST,"架空,銘柄",110';
  it("BOM・引用符・市場指定・重複上書き", () => {
    const d = importCSV(csv, empty, "JP");
    expect(d.stocks[0].name).toBe("架空,銘柄");
    expect(d.prices).toHaveLength(2);
    expect(importCSV(csv, d, "JP").prices).toHaveLength(2);
    expect(importCSV(csv, d, "US").stocks).toHaveLength(2);
  });
  it("不正CSVを全体として拒否、元データを変更しない", () => {
    expect(() =>
      importCSV(csv.replace("2026-02-05", "2026-02-30"), empty, "JP"),
    ).toThrow();
    expect(empty.stocks).toHaveLength(0);
    expect(() => importCSV(csv.replace(",110", ",-1"), empty, "JP")).toThrow();
    expect(() => importCSV("日付,終値\n2026-01-01,10", empty, "JP")).toThrow();
  });
  it("IndexedDB保存とJSON復元の往復", async () => {
    const d = importCSV(csv, empty, "JP");
    d.stocks[0] = { ...d.stocks[0], watch: true, shares: 50, cost: 90 };
    await save(d);
    expect(await load()).toEqual(d);
    const restored = restore(JSON.stringify(await load()));
    await save(empty);
    await save(restored);
    expect(await load()).toEqual(d);
  });
  it("不正JSON・重複・参照不整合・不正保有数を拒否", () => {
    expect(() => restore("{")).toThrow();
    const d = demoData();
    d.stocks[0].shares = -1;
    expect(() => restore(JSON.stringify(d))).toThrow();
    const x = demoData();
    x.prices.push(x.prices[0]);
    expect(() => restore(JSON.stringify(x))).toThrow();
    expect(() =>
      restore(
        JSON.stringify({
          ...empty,
          prices: [{ stockId: "none", date: "2026-01-01", close: 1 }],
        }),
      ),
    ).toThrow();
  });
  it("分析CSVに月間年間を含み、数式文字列を無効化", () => {
    const d = importCSV(csv, empty, "JP");
    d.stocks[0].name = "=1+1";
    const result = analysisCSV(d);
    expect(result).toContain("'=1+1");
    expect(result).toContain("月間");
    expect(result).toContain("年間");
    expect(result).toContain("JPY");
  });
});
