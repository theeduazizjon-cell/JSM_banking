import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside a React Server Components build; in tests
      // the server modules run directly in Node, so swap in an empty module.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/components/**/*.test.tsx"],
    environment: "node",
    mockReset: true,
    restoreMocks: true,
    unstubEnvs: true,
  },
});
