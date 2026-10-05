import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5189, strictPort: true },
  build: {
    chunkSizeWarningLimit: 900,
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
});
