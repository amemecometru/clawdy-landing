import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("cli truth", () => {
  it("defaults to the production endpoint and has no phantom hosts", () => {
    const src = readFileSync("cli/clawdy.mjs", "utf8");
    expect(src).toContain('const BASE_URL = process.env.CLAWDYCLAW_BASE_URL || "https://mcp.clawdyclaw.com"');
    expect(src).not.toContain("logiclemonai");
    expect(src).not.toMatch(/workers\.dev/);
  });

  it("ships a publish-ready package manifest without marking it private", () => {
    const pkg = JSON.parse(readFileSync("cli/package.json", "utf8"));
    expect(pkg.name).toBe("clawdyclaw-cli");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.bin?.clawdy).toBe("./clawdy.mjs");
    expect(pkg.files).toContain("clawdy.mjs");
    expect(pkg.engines?.node).toContain(">=18");
    expect(pkg.private).toBeUndefined();
  });

  it("does not advertise an unpublished package in src or cli", () => {
    const grep = (p: string) => readFileSync(p, "utf8").includes("npm i -g clawdyclaw-cli");
    expect(grep("cli/clawdy.mjs")).toBe(false);
  });
});
