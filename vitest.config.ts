// Standalone vitest config. The app's vite.config.ts comes from the
// @lovable.dev/vite-tanstack-config wrapper (plugins, SSR, nitro), which we do
// NOT want to load for pure unit tests — so we only re-declare the `@/` alias.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
