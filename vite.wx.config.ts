import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    outDir: "minigame",
    emptyOutDir: false,
    target: "es2017",
    lib: {
      entry: "wx/main.ts",
      formats: ["iife"],
      name: "clickton",
      fileName: () => "game.js",
    },
  },
});
