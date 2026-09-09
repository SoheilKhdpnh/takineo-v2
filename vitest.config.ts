import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": projectRoot,
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },

  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["./tests/unit/**/*.{test,spec}.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
  },
});
