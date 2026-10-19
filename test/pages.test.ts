import { describe, expect, it } from "vitest";
import { renderPageHtml, renderPageReact, esc, safeHref } from "../worker/lib/page-render";
import { normaliseSpec } from "../worker/api/pages-normalise";
import {
  PALETTES,
  resolvePalette,
  slugify,
  formatDuration,
  formatMicros,
  type PageSpec,
} from "../shared/pages";

const SPEC: PageSpec = {
  kind: "landing",
  title: "Ledger",
  brand: "Ledger Inc",
  palette: resolvePalette("obsidian"),
  blocks: [
    { type: "hero", eyebrow: "Now", title: "Ship pages, not prompts", body: "A body.", cta: { label: "Start", href: "/start" } },
    { type: "stats", items: [{ label: "Pages", value: "38" }, { label: "Sold", value: "12" }] },
    { type: "features", heading: "Why", items: [{ title: "Deterministic", body: "Tokens, not prose." }] },
    { type: "cards", heading: "Kinds", layout: "carousel", items: [{ title: "OAuth", body: "Consent" }] },
    { type: "cta", title: "Ready", cta: { label: "Go", href: "https://example.com" } },
  ],
};

describe("escaping", () => {
  it("escapes every HTML-significant character", () => {
    expect(esc(`<img src=x onerror="alert('x')">`)).not.toContain("<img");
    expect(esc("a & b")).toBe("a &amp; b");
    expect(esc(`'quoted'`)).toContain("&#39;");
  });

  it("refuses javascript: and data: hrefs", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(safeHref("  JaVaScRiPt:alert(1)")).toBe("#");
  });

  it("allows ordinary schemes and relative paths", () => {
    expect(safeHref("https://a.test/x")).toBe("https://a.test/x");
    expect(safeHref("/p/demo")).toBe("/p/demo");
    expect(safeHref("#anchor")).toBe("#anchor");
    expect(safeHref("mailto:a@b.test")).toBe("mailto:a@b.test");
  });
});

describe("renderPageHtml", () => {
  const html = renderPageHtml(SPEC);

  it("emits a complete standalone document", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("</html>");
    expect(html).toContain("<style>");
  });

  it("carries the palette as custom properties", () => {
    expect(html).toContain(`--accent:${PALETTES.obsidian.accent}`);
    expect(html).toContain(`--bg:${PALETTES.obsidian.bg}`);
  });

  it("renders every block that was asked for", () => {
    expect(html).toContain("Ship pages, not prompts");
    expect(html).toContain("38");
    expect(html).toContain("Deterministic");
    expect(html).toContain('class="carousel"');
    expect(html).toContain("Ready");
  });

  it("inlines no external stylesheet", () => {
    // A hosted page must render with no network beyond the initial fetch.
    expect(html).not.toContain("<link rel=\"stylesheet\"");
  });

  it("neutralises script injection through block content", () => {
    const hostile = renderPageHtml({
      ...SPEC,
      title: "<script>alert(1)</script>",
      blocks: [
        {
          type: "hero",
          title: "<img src=x onerror=alert(1)>",
          cta: { label: "ok", href: "javascript:alert(2)" },
        },
      ],
    });
    expect(hostile).not.toContain("<script>alert");
    expect(hostile).not.toContain("<img src=x");
    expect(hostile).not.toContain("javascript:alert");
  });

  it("renders a consent page for an oauth client", () => {
    const consent = renderPageHtml({
      kind: "oauth_client",
      title: "Authorize",
      palette: resolvePalette("bone"),
      blocks: [
        {
          type: "consent",
          clientName: "Acme",
          clientDescription: "Reads your invoices.",
          scopes: ["Read invoices", "Write refunds"],
        },
      ],
    });
    expect(consent).toContain("Acme");
    expect(consent).toContain("Read invoices");
    expect(consent).toContain("Deny");
  });

  it("falls back rather than emitting an empty document", () => {
    const empty = renderPageHtml({
      kind: "landing",
      title: "Bare",
      palette: resolvePalette("bone"),
      blocks: [],
    });
    expect(empty).toContain("Bare");
    expect(empty).toContain("<h1>");
  });
});

describe("renderPageReact", () => {
  const src = renderPageReact(SPEC);

  it("is a self-contained module with no imports beyond react types", () => {
    expect(src).toContain('import type { CSSProperties, ReactNode } from "react";');
    expect(src).toContain("export default function ClawdyPage");
    expect(src).not.toContain("from \"@/");
    expect(src).not.toContain("from \"clawdy");
  });

  it("emits a switch that handles every block type present", () => {
    for (const block of SPEC.blocks) {
      expect(src).toContain(`case "${block.type}":`);
    }
  });

  it("embeds the spec as data, not as a dangling reference", () => {
    expect(src).toContain("export const SPEC: PageSpec");
    expect(src).toContain("Ledger Inc");
  });

  it("inlines the stylesheet as a string literal so CSS needs no escaping", () => {
    expect(src).toContain("dangerouslySetInnerHTML");
    expect(src).not.toContain("${");
  });
});

describe("normaliseSpec", () => {
  it("defaults an unknown kind to landing and says so", () => {
    const { spec, warnings } = normaliseSpec({ kind: "spaceship", title: "T" });
    expect(spec.kind).toBe("landing");
    expect(warnings.join(" ")).toContain("spaceship");
  });

  it("drops a block it cannot draw and explains why", () => {
    const { spec, warnings } = normaliseSpec({
      kind: "landing",
      title: "T",
      blocks: [{ type: "hero" }, { type: "features", items: [] }, { type: "nonsense" }],
    });
    expect(spec.blocks).toHaveLength(0);
    expect(warnings.length).toBe(3);
  });

  it("accepts a named palette and fills a partial colour object", () => {
    const named = normaliseSpec({ kind: "landing", title: "T", palette: "bone" });
    expect(named.spec.palette).toEqual(PALETTES.bone);

    const partial = normaliseSpec({ kind: "landing", title: "T", palette: { accent: "#123456" } });
    expect(partial.spec.palette.accent).toBe("#123456");
    expect(partial.spec.palette.bg).toBe(PALETTES.obsidian.bg);
  });

  it("gives every form field a usable name", () => {
    const { spec } = normaliseSpec({
      kind: "landing",
      title: "T",
      blocks: [{ type: "form", fields: [{ label: "Email" }, { name: "Weird Name!", label: "X" }] }],
    });
    const form = spec.blocks.find((b) => b.type === "form");
    expect(form?.type === "form" && form.fields.map((f) => f.name)).toEqual(["field-0", "weird-name"]);
  });

  it("falls back to the first hero title when no title is given", () => {
    const { spec } = normaliseSpec({
      kind: "landing",
      blocks: [{ type: "hero", title: "From the hero" }],
    });
    expect(spec.title).toBe("From the hero");
  });
});

describe("helpers", () => {
  it("slugifies safely", () => {
    expect(slugify("Hello World!!")).toBe("hello-world");
    expect(slugify("")).toBe("page");
    expect(slugify("a/b c")).toBe("a-b-c");
  });

  it("formats durations across the ranges the board shows", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(90)).toBe("1m");
    expect(formatDuration(3600 * 5)).toBe("5h");
    expect(formatDuration(86400 * 3)).toBe("3d");
  });

  it("formats micros as money", () => {
    expect(formatMicros(0)).toBe("$0.00");
    expect(formatMicros(1_000_000)).toBe("$1.00");
    expect(formatMicros(2_500_000)).toBe("$2.50");
  });
});