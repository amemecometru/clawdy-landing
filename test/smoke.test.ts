import { it, expect, afterAll } from "vitest";

// Remote smoke test: verifies the deployed ClawdyClaw worker is healthy over
// the public network. Defaults to the production worker (agents.clawdyclaw.com,
// which routes to the clawdyclaw worker and serves /api/health). Override with
// WORKER_URL to target any other environment (staging, wrangler dev, etc.).
const BASE = process.env.WORKER_URL ?? "https://agents.clawdyclaw.com";

afterAll(() => {
  // Ensure nothing holds the event loop open between tests / teardown.
});

// Opt-in deployment check, excluded from the default suite by vitest.config.ts.
// Run it with `npm run test:smoke`. It reaches the public internet, so it gets an
// explicit timeout rather than Vitest's 5s local default, which a network round
// trip can exceed on a loaded machine.
it(
  "serves /api/health with status ok",
  { timeout: 30_000 },
  async () => {
    const res = await fetch(`${BASE}/api/health`, {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe("ok");
  }
);
