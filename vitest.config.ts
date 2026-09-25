import { defineConfig } from "vitest/config";

// Default test runner: plain Vitest node pool. The smoke test hits the worker's
// deployed health endpoint over the network, so it does NOT need local workerd.
// (workerd cannot start in memory-restricted sandboxes — see vitest.workers.config.ts
// + the `test:workers` script for the local Workers-runtime pool.)
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
