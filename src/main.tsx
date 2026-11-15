import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  aggregate,
  analysisCSV,
  demoData,
  empty,
  history,
  importCSV,
  key,
  load,
  periodRates,
  rate,
  restore,
  save,
  valuation,
  type Data,
  type Stock,
} from "./data";
import "./style.css";
const pages = ["ホーム", "ウォッチリスト", "株価チャート", "保有銘柄", "設定"];
const paths = ["home", "watch", "chart", "holdings", "settings"];
const money = (n: number | null | undefined, c = "JPY") =>
  n == null
    ? "未登録"
    : new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: c,
        maximumFractionDigits: 2,
      }).format(n);
const percent = (n: number | null | undefined) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
function download(name: string, text: string, type: string) {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function App() {
  const [data, setData] = useState<Data>(empty),
    [ready, setReady] = useState(false),
    [page, setPage] = useState(location.hash.slice(1) || "home"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [unit, setUnit] = useState("日足"),
    [market, setMarket] = useState<"JP" | "US">("JP"),
    [editing, setEditing] = useState<Stock | null>(null),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    load()
      .then((d) => {
        setData(d);
        setReady(true);
      })
      .catch(() =>
        setMessage(
          "端末内データを開けません。ブラウザの保存設定を確認して再読み込みしてください。",
        ),
      );
    const f = () => setPage(location.hash.slice(1) || "home");
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  async function commit(next: Data) {
    setBusy(true);
    try {
      await save(next);
      setData(next);
      setMessage("端末内に保存しました。");
      return true;
    } catch {
      setMessage(
        "保存できませんでした。空き容量とブラウザの設定を確認してください。",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  const active = data.stocks.find((s) => s.id === selected) ?? data.stocks[0],
    prices = active ? history(data, active.id) : [];
  function table(stocks: Stock[]) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>銘柄 / 市場</th>
              <th>最新終値</th>
              <th>前回比</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {stocks
              .filter((s) =>
                (s.name + s.code).toLowerCase().includes(query.toLowerCase()),
              )
              .map((s) => {
                const h = history(data, s.id),
                  last = h.at(-1);
                return (
                  <tr key={s.id}>
                    <td>
                      <a href="#chart" onClick={() => setSelected(s.id)}>
                        {s.name}
                      </a>
                      <small>
                        {s.code} ·{" "}
                        {s.market === "JP" ? "日本株 / JPY" : "米国株 / USD"}
                      </small>
                    </td>
                    <td>
                      {money(last?.close, s.market === "JP" ? "JPY" : "USD")}
                      <small>{last?.date ?? "株価未登録"}</small>
                    </td>
                    <td>{percent(rate(h.at(-2)?.close, last?.close))}</td>
                    <td>
                      <div className="actions">
                        <button
                          aria-label={`${s.name}のウォッチ切替`}
                          onClick={() =>
                            commit({
                              ...data,
                              stocks: data.stocks.map((x) =>
                                x.id === s.id ? { ...x, watch: !x.watch } : x,
                              ),
                            })
                          }
                        >
                          {s.watch ? "★" : "☆"}
                        </button>
                        <button onClick={() => setEditing(s)}>編集</button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `${s.name}と関連する株価・保有情報を削除しますか？`,
                              )
                            )
                              commit({
                                ...data,
                                stocks: data.stocks.filter(
                                  (x) => x.id !== s.id,
                                ),
                                prices: data.prices.filter(
                                  (p) => p.stockId !== s.id,
                                ),
                              });
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {stocks.length === 0 && (
          <div className="empty">
            銘柄がありません。「銘柄を追加」から始めましょう。
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <span>▥</span> 株の手帳<small>自分のペースで、資産を見つめる。</small>
        </div>
        <nav>
          {pages.map((p, i) => (
            <a
              key={p}
              href={"#" + paths[i]}
              aria-current={page === paths[i] ? "page" : undefined}
            >
              <span>{["⌂", "☆", "↗", "▤", "⚙"][i]}</span>
              {p}
            </a>
          ))}
        </nav>
        <div className="local">
          ● 端末内に保存
          <br />
          <small>アカウント登録は不要です</small>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">あなたの投資ノート</span>
            <h1>{pages[paths.indexOf(page)] ?? "ホーム"}</h1>
          </div>
          <button
            className="primary"
            disabled={!ready || busy}
            onClick={() => setAdding(true)}
          >
            ＋ 銘柄を追加
          </button>
        </header>
        <p className="intro">株価の記録と分析を、ひとつの場所に。</p>
        {message && (
          <div role="status" className="notice">
            {message}
            <button aria-label="通知を閉じる" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {data.demo && (
          <div className="demo">
            架空データを表示中です。実際の株価・保有情報ではありません。
          </div>
        )}
        {!ready ? (
          <p>データを読み込んでいます…</p>
        ) : (
          <fieldset disabled={busy} className="content">
            {page === "home" && (
              <>
                <div className="stats">
                  <article>
                    <small>登録銘柄</small>
                    <strong>
                      {data.stocks.length}
                      <em> 銘柄</em>
                    </strong>
                  </article>
                  <article>
                    <small>ウォッチリスト</small>
                    <strong>
                      {data.stocks.filter((s) => s.watch).length}
                      <em> 銘柄</em>
                    </strong>
                  </article>
                  <article>
                    <small>記録した株価</small>
                    <strong>
                      {data.prices.length}
                      <em> 件</em>
                    </strong>
                  </article>
                </div>
                <section>
                  <div className="section-head">
                    <div>
                      <h2>ウォッチしている銘柄</h2>
                      <p>CSVで記録した最新の終値を確認できます</p>
                    </div>
                    <a href="#watch">すべて見る →</a>
                  </div>
                  {table(data.stocks.filter((s) => s.watch))}
                </section>
                <section className="guide">
                  <div>
                    <span className="eyebrow">はじめの一歩</span>
                    <h2>毎日の記録が、判断のヒントに。</h2>
                    <p>
                      銘柄を登録して、CSVで株価を読み込みましょう。
                      <br />
                      月間・年間の値動きを自分のペースで振り返れます。
                    </p>
                    <a className="button" href="#settings">
                      CSVを読み込む →
                    </a>
                  </div>
                  <div className="guide-icon" aria-hidden="true">
                    ▥ ↗
                  </div>
                </section>
                <p className="muted">
                  株価の自動取得は行いません。記録したデータだけを使って分析します。
                </p>
              </>
            )}
            {page === "watch" && (
              <section>
                <h2>銘柄一覧とウォッチリスト</h2>
                <label>
                  銘柄を検索
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="銘柄名・コード"
                  />
                </label>
                <h3>ウォッチ中</h3>
                {table(data.stocks.filter((s) => s.watch))}
                <h3>すべての銘柄</h3>
                {table(data.stocks)}
                <p className="muted">☆を押すとウォッチリストに追加できます。</p>
              </section>
            )}
            {page === "chart" && (
              <section>
                <h2>終値チャート</h2>
                <div className="filters">
                  <label>
                    銘柄
                    <select
                      value={active?.id ?? ""}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {data.stocks.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}（{s.code}）
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    表示期間
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      {["日足", "週足", "月足"].map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="muted">
                  通貨：{active?.market === "US" ? "USD" : "JPY"} ／
                  週足・月足は各期間の最終記録日の終値です。
                </p>
                {prices.length ? (
                  <>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={aggregate(prices, unit)}
                          margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis dataKey="date" minTickGap={40} />
                          <YAxis domain={["auto", "auto"]} width={65} />
                          <Tooltip
                            formatter={(v) => [
                              money(
                                Number(v),
                                active?.market === "US" ? "USD" : "JPY",
                              ),
                              "終値",
                            ]}
                          />
                          <Line
                            type="linear"
                            dataKey="close"
                            stroke="#247d66"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <h3>月間・年間騰落率</h3>
                    <p className="muted">
                      直前の記録がある月・年の最終終値との比較です。初回は「—」。未記録期間を挟む場合も直前の記録と比較します。
                    </p>
                    <div className="rate-grid">
                      {(["month", "year"] as const).map((u) => (
                        <div key={u}>
                          <h3>{u === "month" ? "月間" : "年間"}</h3>
                          <table>
                            <thead>
                              <tr>
                                <th>期間</th>
                                <th>終値</th>
                                <th>騰落率</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodRates(prices, u)
                                .reverse()
                                .map((p) => (
                                  <tr key={p.period}>
                                    <td>{p.period}</td>
                                    <td>
                                      {money(
                                        p.close,
                                        active?.market === "US" ? "USD" : "JPY",
                                      )}
                                    </td>
                                    <td>{percent(p.rate)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="empty">
                    表示する株価がありません。設定からCSVを読み込んでください。
                  </div>
                )}
              </section>
            )}
            {page === "holdings" && (
              <>
                <div className="stats">
                  {(["JP", "US"] as const).map((m) => {
                    const ss = data.stocks.filter(
                        (s) => s.market === m && s.shares > 0,
                      ),
                      vs = ss.map((s) =>
                        valuation(s, history(data, s.id).at(-1)?.close),
                      ),
                      missing = vs.some((v) => v.value === null);
                    return (
                      <article key={m}>
                        <small>
                          {m === "JP" ? "日本株（JPY）" : "米国株（USD）"}{" "}
                          評価額
                        </small>
                        <strong>
                          {money(
                            vs.reduce((a, v) => a + (v.value ?? 0), 0),
                            m === "JP" ? "JPY" : "USD",
                          )}
                        </strong>
                        <p>
                          評価損益{" "}
                          {money(
                            vs.reduce((a, v) => a + (v.profit ?? 0), 0),
                            m === "JP" ? "JPY" : "USD",
                          )}
                        </p>
                        {missing && <small>株価未登録の銘柄を除く</small>}
                      </article>
                    );
                  })}
                </div>
                <section>
                  <h2>保有情報</h2>
                  <p className="muted">
                    銘柄の「編集」で株数と取得単価を登録します。異なる通貨の合算は行いません。
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>銘柄</th>
                          <th>株数 / 取得単価</th>
                          <th>評価額 / 評価損益</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.stocks
                          .filter((s) => s.shares > 0)
                          .map((s) => {
                            const v = valuation(
                                s,
                                history(data, s.id).at(-1)?.close,
                              ),
                              c = s.market === "JP" ? "JPY" : "USD";
                            return (
                              <tr key={s.id}>
                                <td>
                                  {s.name}
                                  <small>
                                    {s.code} · {c}
                                  </small>
                                </td>
                                <td>
                                  {s.shares}株<small>{money(s.cost, c)}</small>
                                </td>
                                <td>
                                  {money(v.value, c)}
                                  <small>{money(v.profit, c)}</small>
                                </td>
                                <td>
                                  <button onClick={() => setEditing(s)}>
                                    編集
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
            {page === "settings" && (
              <div className="settings">
                <section>
                  <h2>株価CSVの読み込み</h2>
                  <p>
                    UTF-8のCSVを選択してください。同じ市場・コード・日付の株価は上書きし、新しい銘柄は自動登録します。
                  </p>
                  <code>
                    日付,銘柄コード,銘柄名,終値
                    <br />
                    2026-01-05,DEMO1,サンプル（架空）,1500
                  </code>
                  <label>
                    読み込む市場
                    <select
                      value={market}
                      onChange={(e) => setMarket(e.target.value as "JP" | "US")}
                    >
                      <option value="JP">日本株（JPY）</option>
                      <option value="US">米国株（USD）</option>
                    </select>
                  </label>
                  <label className="file">
                    CSVファイル
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f)
                          try {
                            await commit(
                              importCSV(await f.text(), data, market),
                            );
                          } catch (err) {
                            setMessage((err as Error).message);
                          }
                      }}
                    />
                  </label>
                </section>
                <section>
                  <h2>バックアップと復元</h2>
                  <p>
                    データはこのブラウザだけに保存されます。機種変更やブラウザのデータ削除に備えて、定期的にバックアップしてください。
                  </p>
                  <button
                    onClick={() =>
                      download(
                        "株の手帳-backup.json",
                        JSON.stringify(data, null, 2),
                        "application/json",
                      )
                    }
                  >
                    JSONバックアップを保存
                  </button>
                  <label className="file">
                    JSONから全データを復元
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f)
                          try {
                            const d = restore(await f.text());
                            if (
                              confirm(
                                "現在の全データをバックアップの内容で置き換えますか？",
                              )
                            )
                              await commit(d);
                          } catch (err) {
                            setMessage((err as Error).message);
                          }
                      }}
                    />
                  </label>
                  <p className="muted">
                    ファイルには保有情報が含まれます。安全な場所に保管してください。
                  </p>
                </section>
                <section>
                  <h2>分析結果の書き出し</h2>
                  <p>全銘柄の月間・年間騰落率をCSVで保存します。</p>
                  <button
                    onClick={() =>
                      download(
                        "株価分析.csv",
                        analysisCSV(data),
                        "text/csv;charset=utf-8",
                      )
                    }
                  >
                    分析CSVを保存
                  </button>
                </section>
                <section>
                  <h2>デモデータ</h2>
                  <p>
                    架空の2銘柄の値動きを試せます。現在のデータを置き換えます。
                  </p>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "全データを架空のデモデータに置き換えますか？必要な場合は先にバックアップしてください。",
                        )
                      )
                        commit(demoData());
                    }}
                  >
                    架空データを試す
                  </button>
                </section>
                <section>
                  <h2>アプリとして使う</h2>
                  <p>
                    iPhone：Safariの共有メニュー →「ホーム画面に追加」。
                    <br />
                    Windows：EdgeまたはChromeのメニューから「アプリをインストール」。
                    <br />
                    初回読み込み後はオフラインでも利用できます。端末間の自動同期はありません。移行にはJSONを使ってください。
                  </p>
                </section>
              </div>
            )}
          </fieldset>
        )}
        <footer>
          株の手帳 · データはあなたの端末に。
          <br />
          投資判断はご自身の責任で行ってください。
        </footer>
      </main>
      {(adding || editing) && (
        <div className="overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
          >
            <h2 id="edit-title">{editing ? "銘柄を編集" : "銘柄を追加"}</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  market = f.get("market") as "JP" | "US",
                  code = String(f.get("code")).trim().toUpperCase(),
                  name = String(f.get("name")).trim(),
                  shares = Number(f.get("shares")),
                  cost = Number(f.get("cost")),
                  id = key(market, code);
                if (
                  !code ||
                  !name ||
                  !Number.isFinite(shares) ||
                  !Number.isFinite(cost) ||
                  shares < 0 ||
                  cost < 0
                ) {
                  setMessage("入力内容を確認してください。");
                  return;
                }
                if (
                  data.stocks.some((s) => s.id === id && s.id !== editing?.id)
                ) {
                  setMessage("同じ市場・コードの銘柄が登録されています。");
                  return;
                }
                const s: Stock = {
                  id,
                  code,
                  name,
                  market,
                  shares,
                  cost,
                  watch: f.get("watch") === "on",
                };
                if (
                  await commit({
                    ...data,
                    stocks: editing
                      ? data.stocks.map((x) => (x.id === editing.id ? s : x))
                      : [...data.stocks, s],
                    prices: editing
                      ? data.prices.map((p) =>
                          p.stockId === editing.id ? { ...p, stockId: id } : p,
                        )
                      : data.prices,
                  })
                ) {
                  setEditing(null);
                  setAdding(false);
                }
              }}
            >
              <label>
                市場
                <select name="market" defaultValue={editing?.market ?? "JP"}>
                  <option value="JP">日本株（JPY）</option>
                  <option value="US">米国株（USD）</option>
                </select>
              </label>
              <label>
                銘柄コード
                <input
                  autoFocus
                  name="code"
                  required
                  maxLength={30}
                  defaultValue={editing?.code}
                />
              </label>
              <label>
                銘柄名
                <input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={editing?.name}
                />
              </label>
              <label>
                保有株数
                <input
                  name="shares"
                  type="number"
                  min="0"
                  step="any"
                  required
                  defaultValue={editing?.shares ?? 0}
                />
              </label>
              <label>
                取得単価（市場の通貨）
                <input
                  name="cost"
                  type="number"
                  min="0"
                  step="any"
                  required
                  defaultValue={editing?.cost ?? 0}
                />
              </label>
              <label className="check">
                <input
                  name="watch"
                  type="checkbox"
                  defaultChecked={editing?.watch ?? true}
                />
                ウォッチリストに追加
              </label>
              <div className="actions">
                <button className="primary" disabled={busy}>
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(false);
                  }}
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
