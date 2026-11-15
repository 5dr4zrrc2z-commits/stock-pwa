import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:4173/stock-pwa/",
    browserName: "chromium",
    launchOptions: process.env.CI
      ? {}
      : { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173/stock-pwa/",
    reuseExistingServer: !process.env.CI,
  },
});
