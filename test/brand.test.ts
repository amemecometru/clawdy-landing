import { describe, expect, it } from "vitest";
import {
  boundedInteger,
  buildDefaultSections,
  domainAddonPrice,
  isValidDomainName,
  isValidEmail,
  mockDomainAvailable,
  normalizeDomainName,
  normalizeTld,
  parseJson,
  tierMonthlyPrice,
  tierSetupPrice,
} from "../src/lib/brand";

describe("domain + tier helpers", () => {
  it("normalizes TLDs with or without a leading dot", () => {
    expect(normalizeTld("com")).toBe(".com");
    expect(normalizeTld(".AI")).toBe(".ai");
    expect(normalizeTld(undefined)).toBe(".com");
    expect(normalizeTld("   ")).toBe(".com");
  });

  it("normalizes domain input down to a bare hostname", () => {
    expect(normalizeDomainName("https://www.Jane-Doe.dev/about?x=1")).toBe("jane-doe.dev");
    expect(normalizeDomainName("  --jane_roe.com--  ")).toBe("janeroe.com");
    expect(normalizeDomainName("")).toBe("");
  });

  it("validates hostnames and emails", () => {
    expect(isValidDomainName("jane-doe.com")).toBe(true);
    expect(isValidDomainName("jane.doe.co.uk")).toBe(true);
    expect(isValidDomainName("no-tld")).toBe(false);
    expect(isValidDomainName("bad_underscore.com")).toBe(false);
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("jane@example")).toBe(false);
  });

  it("returns a deterministic simulated availability result", () => {
    const first = mockDomainAvailable("jane-doe", ".com");
    expect(mockDomainAvailable("jane-doe", ".com")).toBe(first);
    expect(typeof first).toBe("boolean");
  });

  it("prices tiers and TLD addons", () => {
    expect(tierSetupPrice("basic")).toBe(99);
    expect(tierSetupPrice("professional")).toBe(299);
    expect(tierSetupPrice("sophisticated")).toBe(599);
    expect(tierMonthlyPrice("sophisticated")).toBeGreaterThan(tierMonthlyPrice("basic"));
    expect(domainAddonPrice(".ai")).toBe(15);
    expect(domainAddonPrice(".com")).toBe(0);
  });

  it("clamps integers and falls back safely", () => {
    expect(boundedInteger("12", 5, 1, 10)).toBe(10);
    expect(boundedInteger(-4, 5, 1, 10)).toBe(1);
    expect(boundedInteger("nope", 5, 1, 10)).toBe(5);
    expect(boundedInteger(undefined, 7, 1, 10)).toBe(7);
  });

  it("parses JSON with a fallback", () => {
    expect(parseJson<{ a: number }>('{"a":1}', { a: 0 })).toEqual({ a: 1 });
    expect(parseJson<{ a: number }>("not json", { a: 9 })).toEqual({ a: 9 });
    expect(parseJson<null>(null, null)).toBeNull();
  });
});

describe("buildDefaultSections", () => {
  const person = {
    first_name: "Jane",
    last_name: "Doe",
    current_role: "Data Analyst",
    target_role: "Analytics Engineer",
  };

  it("seeds hero, about and cta for the basic tier", () => {
    const sections = buildDefaultSections(person, "basic");
    expect(sections.map((section) => section.section_type)).toEqual(["hero", "about", "cta"]);
    expect(sections.every((section) => section.tier_minimum === "basic")).toBe(true);
  });

  it("adds portfolio and services for the professional tier", () => {
    const sections = buildDefaultSections(person, "professional");
    const types = sections.map((section) => section.section_type);
    expect(types).toContain("portfolio");
    expect(types).toContain("services");
    expect(types).not.toContain("testimonials");
  });

  it("adds testimonials and blog for the sophisticated tier", () => {
    const types = buildDefaultSections(person, "sophisticated").map((section) => section.section_type);
    expect(types).toContain("testimonials");
    expect(types).toContain("blog");
  });

  it("produces ordered, parseable content", () => {
    const sections = buildDefaultSections(person, "professional");
    expect(sections.map((section) => section.display_order)).toEqual(
      sections.map((_, index) => index)
    );
    const hero = sections[0];
    const content = parseJson<{ headline: string }>(hero.content, { headline: "" });
    expect(content.headline).toContain("Jane");
    expect(content.headline).toContain("Data Analyst");
  });
});
