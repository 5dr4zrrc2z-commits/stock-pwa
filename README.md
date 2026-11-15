# 株の手帳

iPhone・Windows PCで使える、日本語の株価分析・銘柄管理PWAです。
公開先： https://5dr4zrrc2z-commits.github.io/stock-pwa/

## 使い方

1. 「銘柄を追加」で市場、コード、名前を入力します。日本株はJPY、米国株はUSDです。
2. 「ウォッチリスト」の☆でウォッチを切り替えます。「編集」で名前・コード・市場・保有株数・取得単価を変更できます。「削除」は関連する株価も削除するため確認が表示されます。
3. 「設定」で読み込む市場を選び、UTF-8の株価CSVを選択します。列名は下記のとおりです。日付は実在する `YYYY-MM-DD`、終値は正の数を指定します。カンマを含む名前や数値は二重引用符で囲んでください。終値の桁区切りカンマは使用しないでください。

```csv
日付,銘柄コード,銘柄名,終値
2026-01-05,DEMO1,サンプル株式会社（架空）,1500
2026-02-05,DEMO1,サンプル株式会社（架空）,1650
```

4. 未登録の銘柄は自動作成されます。同じ市場・コード・日付は後の行で上書きされます。不正な行がある場合はファイル全体を取り込みません。日本株・米国株は別々に読み込んでください。
5. 「株価チャート」で日足・週足・月足を切り替えます。CSVは終値のみのためローソク足ではなく折れ線です。週足は月曜開始、週・月の最後に記録した終値を使います。
6. 月間・年間騰落率は `(当期間の最終終値 / 直前の記録がある期間の最終終値 - 1) × 100`。最初の期間は比較できないため「—」です。未記録期間を挟んだ場合も直前の記録との比較になり、年間は年初来または年末比較の記録済みデータに基づく値です。
7. 「保有銘柄」は株数が0より大きい銘柄を表示します。評価額は `最新記録終値 × 株数`、評価損益は `(最新記録終値 - 取得単価) × 株数`。手数料・税金・配当・為替は考慮しません。株価未登録は未登録と表示し集計から除外します。JPYとUSDは合算しません。
8. 「設定」の「分析CSVを保存」で全銘柄の月間・年間の分析結果を出力します。Excelでも開きやすいUTF-8 BOM付きです。

## 保存・移行・バックアップ

データはブラウザのIndexedDBに保存されます。サーバー送信、自動同期、Firebase、OpenAI API、株価APIは使用しません。初期状態は空で、設定から読み込めるデモはすべて架空データです。デモ読み込みは現在の全データを置き換えます。

「JSONバックアップを保存」で銘柄・ウォッチ・株価・保有数・取得単価を保存します。別端末で同じアプリを開き、「JSONから全データを復元」で移行できます。形式を検証し、確認後に全データを置き換えます。復元に失敗した場合は既存データを維持します。

ブラウザの保存データ削除、プライベートモード、端末故障、容量不足などでデータを失う場合があります。定期的にJSONを保存してください。iPhoneのSafariとホーム画面アプリは保存領域が異なる場合があるため、JSONで移行してください。バックアップには保有情報が含まれます。GitHubにアップロードせず、安全な場所に保管してください。APIキーや実際の保有情報をソースに記載しないでください。

## インストール

- iPhone：Safariで公開URLを開き、共有 →「ホーム画面に追加」。
- Windows：Edge/Chromeで公開URLを開き、ブラウザのアプリインストール機能を使用します。
- 初回オンライン読み込みとService Workerの準備後は、オフラインでも使用できます。更新はオンライン時に取得されます。

## 開発と検証

Node.js 22.12以上（推奨22 LTS）を使用します。

```sh
npm install
npm test
npm run build
npx playwright install chromium
CI=true npm run test:e2e
npm run dev
```

開発URLは `http://localhost:5173/stock-pwa/`。ビルドは `dist` に出力します。`npm run preview` は `http://localhost:4173/stock-pwa/` で確認できます。E2EはローカルLinuxでは `/usr/bin/chromium` を使用し、`CI=true` ではPlaywright管理ブラウザを使用します。

自動テストは騰落率・評価損益・日週月集計・CSV検証と重複処理・IndexedDB保存・JSON検証と復元・分析CSVを対象にしています。E2Eでは390px/1440pxの画面で登録→CSV→評価損益→チャート→JSONダウンロード/復元→再読み込み、manifest・アイコン・Service Worker・オフライン再読み込みを検証します。実機iPhoneのホーム画面追加は別途確認してください。

## GitHub Pages公開手順

1. このPRを `main` にマージします。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。
3. **Actions** で「GitHub Pagesへ公開」が成功することを確認します。必要なら **Run workflow** からmainに対して再実行してください。
4. https://5dr4zrrc2z-commits.github.io/stock-pwa/ を開きます。

`.github/workflows/deploy.yml` はmain更新時にテスト、ビルド、ブラウザテスト後に自動公開します。PRでも同じ検証を行いますが公開しません。全体の権限は `contents: read`、公開ジョブだけ `pages: write` と `id-token: write` を付与しています。環境 `github-pages` の承認ルールが設定されている場合は管理画面で対応してください。

Viteのbase、manifestのstart_url/scope、Service Workerは `/stock-pwa/` に統一しています。遷移は `#/chart` 等のハッシュ形式のため、GitHub Pagesへの直接アクセスや再読み込みでも画面用パスの404は起きません。公開URLを変更する場合はvite.config.tsとindex.htmlのアイコンURLを変更してください。

## 技術

React / TypeScript / Vite / Recharts / IndexedDB (idb) / Papa Parse / vite-plugin-pwa / Vitest / Playwright。
