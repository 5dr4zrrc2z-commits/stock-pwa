import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "/stock-pwa/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      scope: "/stock-pwa/",
      base: "/stock-pwa/",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "株の手帳 ― 株価分析・銘柄管理",
        short_name: "株の手帳",
        lang: "ja",
        start_url: "/stock-pwa/",
        scope: "/stock-pwa/",
        display: "standalone",
        background_color: "#f5f7f4",
        theme_color: "#123b35",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
      },
      workbox: {
        navigateFallback: "/stock-pwa/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
    }),
  ],
  build: { outDir: "dist" },
});
