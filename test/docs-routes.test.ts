import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveDocsRoute, DOCS_PAGES, DOC_COMMANDS, BASE } from "../src/pages/docs/docs-nav";

describe("docs routes", () => {
  it("maps /docs and /docs/ to landing", () => {
    expect(resolveDocsRoute("/docs")).toEqual({ kind: "landing" });
    expect(resolveDocsRoute("/docs/")).toEqual({ kind: "landing" });
  });

  it("maps /docs/cli-reference to page", () => {
    expect(resolveDocsRoute("/docs/cli-reference")).toEqual({ kind: "page", slug: "cli-reference" });
  });

  it("redirects /studio/cli to /docs/cli-reference (preserve inbound links)", () => {
    expect(resolveDocsRoute("/studio/cli")).toEqual({ kind: "redirect", to: "/docs/cli-reference" });
    expect(resolveDocsRoute("/studio/cli/")).toEqual({ kind: "redirect", to: "/docs/cli-reference" });
  });

  it("redirects unknown /docs paths to /docs", () => {
    expect(resolveDocsRoute("/docs/unknown")).toEqual({ kind: "redirect", to: "/docs" });
  });

  it("exports CLI reference content that matches the real CLI switch", () => {
    const src = readFileSync("cli/clawdy.mjs", "utf8");
    for (const c of DOC_COMMANDS) {
      if ((c as any).path) {
        expect(src.includes((c as any).path), `missing path ${(c as any).path} in cli`).toBe(true);
      }
      if ((c as any).commandKey) {
        expect(src.includes(`case "${(c as any).commandKey}":`), `missing case ${(c as any).commandKey}`).toBe(true);
      }
    }
    expect(DOCS_PAGES.some((p) => p.slug === "cli-reference")).toBe(true);
    expect(BASE).toBe("https://mcp.clawdyclaw.com");
  });
});
