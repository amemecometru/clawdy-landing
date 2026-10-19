import { configDefaults, defineConfig } from "vitest/config";

// Default test runner: plain Vitest node pool, local correctness only.
//
// test/smoke.test.ts is excluded here. It fetches the deployed worker's health
// endpoint over the public network, so it measures the deployment and the
// network — not this codebase — and it inherits every local slowdown when the
// suite runs in parallel. Run it deliberately with `npm run test:smoke`.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "test/smoke.test.ts"],

    // Files run sequentially. Under Vitest's default per-file parallelism this
    // box starves itself: a run measured 295s with 4 failures, including
    // `toAtomicUnits` — pure BigInt string math — taking 104s. The same suite
    // sequentially is 38s and green. Several files also boot a Worker per test,
    // so parallel workers oversubscribe the CPU rather than using it.
    fileParallelism: false,
  },
});