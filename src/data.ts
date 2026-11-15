import Papa from "papaparse";
import { openDB } from "idb";
export type Stock = {
  id: string;
  code: string;
  name: string;
  market: "JP" | "US";
  watch: boolean;
  shares: number;
  cost: number;
};
export type Price = { stockId: string; date: string; close: number };
export type Data = {
  version: 1;
  stocks: Stock[];
  prices: Price[];
  demo: boolean;
};
export const empty: Data = { version: 1, stocks: [], prices: [], demo: false };
export const key = (market: string, code: string) =>
  `${market}:${code.trim().toUpperCase()}`;
export function rate(
  previous: number | undefined,
  current: number | undefined,
) {
  return previous !== undefined && previous > 0 && current !== undefined
    ? (current / previous - 1) * 100
    : null;
}
export function valuation(stock: Stock, last?: number) {
  return {
    value: last === undefined ? null : last * stock.shares,
    profit: last === undefined ? null : (last - stock.cost) * stock.shares,
  };
}
export function history(data: Data, id: string) {
  return data.prices
    .filter((p) => p.stockId === id)
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function periodRates(prices: Price[], unit: "month" | "year") {
  const groups = new Map<string, Price>();
  for (const p of [...prices].sort((a, b) => a.date.localeCompare(b.date)))
    groups.set(p.date.slice(0, unit === "month" ? 7 : 4), p);
  return [...groups].map(([period, p], i, all) => ({
    period,
    close: p.close,
    rate: i ? rate(all[i - 1][1].close, p.close) : null,
  }));
}
export function aggregate(prices: Price[], unit: string) {
  const groups = new Map<string, Price>();
  for (const p of [...prices].sort((a, b) => a.date.localeCompare(b.date))) {
    let k = p.date;
    if (unit === "月足") k = k.slice(0, 7);
    if (unit === "週足") {
      const d = new Date(p.date + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      k = d.toISOString().slice(0, 10);
    }
    groups.set(k, p);
  }
  return [...groups.values()];
}
const db = () =>
  openDB("stock-notebook", 1, {
    upgrade(db) {
      db.createObjectStore("data");
    },
  });
export async function load(): Promise<Data> {
  const d = await db();
  return (await d.get("data", "all")) ?? structuredClone(empty);
}
export async function save(data: Data) {
  const d = await db();
  await d.put("data", data, "all");
}
function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
export function validDate(s: string) {
  const d = new Date(s + "T00:00:00Z");
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(+d) &&
    d.toISOString().slice(0, 10) === s
  );
}
export function restore(text: string): Data {
  const d = JSON.parse(text);
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.stocks) ||
    !Array.isArray(d.prices) ||
    typeof d.demo !== "boolean"
  )
    throw Error("バックアップの形式が正しくありません。");
  const ids = new Set<string>();
  for (const s of d.stocks) {
    if (
      !s ||
      typeof s.code !== "string" ||
      !s.code.trim() ||
      typeof s.name !== "string" ||
      !s.name.trim() ||
      !["JP", "US"].includes(s.market) ||
      s.id !== key(s.market, s.code) ||
      ids.has(s.id) ||
      typeof s.watch !== "boolean" ||
      !number(s.shares) ||
      !number(s.cost)
    )
      throw Error("銘柄データが正しくありません。");
    ids.add(s.id);
  }
  const dates = new Set<string>();
  for (const p of d.prices) {
    const k = p?.stockId + "@" + p?.date;
    if (
      !p ||
      !ids.has(p.stockId) ||
      typeof p.date !== "string" ||
      !validDate(p.date) ||
      !number(p.close) ||
      p.close === 0 ||
      dates.has(k)
    )
      throw Error("株価データが正しくありません。");
    dates.add(k);
  }
  return d;
}
export function importCSV(text: string, data: Data, market: "JP" | "US"): Data {
  const parsed = Papa.parse<Record<string, string>>(
    text.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
    },
  );
  if (
    parsed.errors.length ||
    !["日付", "銘柄コード", "銘柄名", "終値"].every((h) =>
      parsed.meta.fields?.includes(h),
    )
  )
    throw Error("CSVの列は「日付,銘柄コード,銘柄名,終値」にしてください。");
  if (!parsed.data.length) throw Error("CSVにデータがありません。");
  const result = structuredClone(data);
  const prices = new Map(
    result.prices.map((p) => [p.stockId + "@" + p.date, p]),
  );
  parsed.data.forEach((r, i) => {
    const code = r["銘柄コード"]?.trim().toUpperCase(),
      name = r["銘柄名"]?.trim(),
      date = r["日付"]?.trim(),
      raw = r["終値"]?.trim(),
      close = Number(raw);
    if (
      !code ||
      !name ||
      !validDate(date ?? "") ||
      !raw ||
      !number(close) ||
      close <= 0
    )
      throw Error(
        `${i + 2}行目：日付・コード・名前・正の終値を確認してください。`,
      );
    const id = key(market, code);
    if (!result.stocks.some((s) => s.id === id))
      result.stocks.push({
        id,
        code,
        name,
        market,
        watch: false,
        shares: 0,
        cost: 0,
      });
    prices.set(id + "@" + date, { stockId: id, date, close });
  });
  result.prices = [...prices.values()];
  return result;
}
export function analysisCSV(data: Data) {
  const rows = data.stocks.flatMap((s) => {
    const h = history(data, s.id);
    return (["month", "year"] as const).flatMap((u) =>
      periodRates(h, u).map((p) => ({
        市場: s.market === "JP" ? "日本株" : "米国株",
        通貨: s.market === "JP" ? "JPY" : "USD",
        銘柄コード: s.code,
        銘柄名: s.name,
        集計: u === "month" ? "月間" : "年間",
        期間: p.period,
        終値: p.close,
        "騰落率(%)": p.rate ?? "",
      })),
    );
  });
  return (
    "\uFEFF" +
    Papa.unparse(
      rows.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k,
            typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? "'" + v : v,
          ]),
        ),
      ),
    )
  );
}
export function demoData(): Data {
  const stocks: Stock[] = [
    {
      id: "JP:DEMO1",
      code: "DEMO1",
      name: "さくらテクノ（架空）",
      market: "JP",
      watch: true,
      shares: 0,
      cost: 0,
    },
    {
      id: "US:DEMO2",
      code: "DEMO2",
      name: "オーシャンラボ（架空）",
      market: "US",
      watch: true,
      shares: 0,
      cost: 0,
    },
  ];
  const prices: Price[] = [];
  for (let i = 0; i < 420; i++) {
    const d = new Date(Date.UTC(2025, 0, 1 + i));
    if ([0, 6].includes(d.getUTCDay())) continue;
    stocks.forEach((s, j) =>
      prices.push({
        stockId: s.id,
        date: d.toISOString().slice(0, 10),
        close:
          Math.round(
            (j ? 80 : 1800) *
              (1 + i * 0.0006 + Math.sin(i * 0.12) * 0.04) *
              100,
          ) / 100,
      }),
    );
  }
  return { version: 1, stocks, prices, demo: true };
}
