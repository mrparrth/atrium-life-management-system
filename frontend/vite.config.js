import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "atrium-icon.svg", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "Atrium Life Planner",
        short_name: "Atrium",
        description: "A premium local-first life management app.",
        theme_color: "#F9F8F6",
        background_color: "#F9F8F6",
        display: "standalone",
        orientation: "portrait-primary",
        icons: [
          {
            src: "atrium-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        globStrict: false,
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: { clientPort: 443, protocol: "wss" },
    allowedHosts: true,
  },
});
