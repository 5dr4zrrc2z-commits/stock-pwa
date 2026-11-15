import { test, expect } from "@playwright/test";
for (const width of [390, 1440])
  test(`登録・CSV・バックアップ・復元・再読込・オフライン ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("./");
    await page.getByRole("button", { name: "＋ 銘柄を追加" }).click();
    await page.getByLabel("銘柄コード", { exact: true }).fill("TEST");
    await page.getByLabel("銘柄名", { exact: true }).fill("架空テスト");
    await page.getByLabel("保有株数", { exact: true }).fill("10");
    await page.getByLabel("取得単価（市場の通貨）").fill("100");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /設定/ })
      .click();
    await page
      .getByLabel("CSVファイル", { exact: true })
      .setInputFiles({
        name: "prices.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "日付,銘柄コード,銘柄名,終値\n2026-01-05,TEST,架空テスト,100\n2026-02-05,TEST,架空テスト,120",
        ),
      });
    await expect(page.getByRole("status")).toContainText("保存しました");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "JSONバックアップを保存" }).click();
    const backup = await downloadPromise;
    const backupPath = await backup.path();
    expect(backupPath).toBeTruthy();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /保有銘柄/ })
      .click();
    await expect(
      page.getByText("￥1,200", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("￥200", { exact: true })).toBeVisible();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /株価チャート/ })
      .click();
    await expect(page.getByText("+20.00%", { exact: true })).toBeVisible();
    await page.getByLabel("表示期間").selectOption("週足");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "終値チャート" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("navigation")
      .getByRole("link", { name: /設定/ })
      .click();
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "架空データを試す" }).click();
    await expect(
      page.getByText("架空データを表示中です。", { exact: false }),
    ).toBeVisible();
    await page.getByLabel("JSONから全データを復元").setInputFiles(backupPath!);
    await expect(
      page.getByText("架空データを表示中です。", { exact: false }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "バックアップと復元" }),
    ).toBeVisible();
    const manifest = await (
      await page.request.get("manifest.webmanifest")
    ).json();
    expect(manifest.scope).toBe("/stock-pwa/");
    expect(manifest.start_url).toBe("/stock-pwa/");
    for (const icon of manifest.icons)
      expect((await page.request.get(icon.src)).ok()).toBe(true);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "バックアップと復元" }),
    ).toBeVisible();
  });
