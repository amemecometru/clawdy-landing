/**
 * Spec normalisation — turning whatever an agent sent into a PageSpec the
 * renderer can always draw.
 *
 * Extracted from pages.ts so the MCP executor can reuse it without importing the
 * router. An agent is not a browser: it may send a half-formed block, a colour
 * it invented, or blocks as a JSON string. Every such case is coerced or
 * dropped here with a warning, so a bad order produces a visible warning rather
 * than a blank page.
 */

import {
  PAGE_KINDS,
  resolvePalette,
  slugify,
  type PageBlock,
  type PageKind,
  type PageSpec,
  type PageStatus,
} from "../../shared/pages";

export function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function isKind(v: unknown): v is PageKind {
  return typeof v === "string" && (PAGE_KINDS as string[]).includes(v);
}

export function isStatus(v: unknown): v is PageStatus {
  return (
    v === "draft" || v === "building" || v === "review" || v === "published" || v === "failed"
  );
}

/**
 * Coerce whatever the agent sent into a valid PageSpec.
 *
 * An agent is not a browser: it may send a half-formed block or a colour it
 * invented. Normalising here is what keeps a bad order from producing a broken
 * page — the renderer only ever sees shapes it can draw.
 */
export function normaliseSpec(input: Record<string, unknown>): { spec: PageSpec; warnings: string[] } {
  const warnings: string[] = [];
  const kind: PageKind = isKind(input.kind) ? input.kind : "landing";
  if (!isKind(input.kind) && input.kind !== undefined) {
    warnings.push(`unknown kind "${String(input.kind)}", defaulted to landing`);
  }

  const blocks: PageBlock[] = [];
  const rawBlocks = Array.isArray(input.blocks) ? input.blocks : [];

  for (const raw of rawBlocks.slice(0, 24)) {
    if (!raw || typeof raw !== "object") {
      warnings.push("dropped a non-object block");
      continue;
    }
    const b = raw as Record<string, unknown>;
    switch (b.type) {
      case "hero": {
        const title = str(b.title, 160);
        if (!title) {
          warnings.push("dropped a hero with no title");
          break;
        }
        blocks.push({
          type: "hero",
          title,
          ...(str(b.eyebrow) ? { eyebrow: str(b.eyebrow, 60) } : {}),
          ...(str(b.body) ? { body: str(b.body, 600) } : {}),
          ...(b.cta && typeof b.cta === "object"
            ? {
                cta: {
                  label: str((b.cta as Record<string, unknown>).label, 40) || "Get started",
                  href: str((b.cta as Record<string, unknown>).href, 300),
                },
              }
            : {}),
        });
        break;
      }
      case "features": {
        const items = Array.isArray(b.items)
          ? b.items
              .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
              .map((i) => ({ title: str(i.title, 80), body: str(i.body, 400) }))
              .filter((i) => i.title)
              .slice(0, 9)
          : [];
        if (!items.length) {
          warnings.push("dropped a features block with no usable items");
          break;
        }
        blocks.push({
          type: "features",
          items,
          ...(str(b.heading) ? { heading: str(b.heading, 120) } : {}),
          ...(b.columns === 2 ? { columns: 2 as const } : {}),
        });
        break;
      }
      case "cards": {
        const items = Array.isArray(b.items)
          ? b.items
              .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
              .map((i) => ({
                title: str(i.title, 80),
                ...(str(i.body) ? { body: str(i.body, 300) } : {}),
                ...(str(i.tag) ? { tag: str(i.tag, 30) } : {}),
                ...(str(i.href) ? { href: str(i.href, 300) } : {}),
              }))
              .filter((i) => i.title)
              .slice(0, 12)
          : [];
        if (!items.length) {
          warnings.push("dropped a cards block with no usable items");
          break;
        }
        blocks.push({
          type: "cards",
          items,
          ...(str(b.heading) ? { heading: str(b.heading, 120) } : {}),
          ...(b.layout === "carousel" ? { layout: "carousel" as const } : {}),
        });
        break;
      }
      case "stats": {
        const items = Array.isArray(b.items)
          ? b.items
              .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
              .map((i) => ({ label: str(i.label, 60), value: str(i.value, 40) }))
              .filter((i) => i.label && i.value)
              .slice(0, 6)
          : [];
        if (!items.length) {
          warnings.push("dropped a stats block with no usable items");
          break;
        }
        blocks.push({ type: "stats", items });
        break;
      }
      case "form": {
        const fields = Array.isArray(b.fields)
          ? b.fields
              .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
              .map((f, i) => ({
                name: slugify(str(f.name) || `field_${i}`),
                label: str(f.label) || str(f.name) || `Field ${i + 1}`,
                type:
                  f.type === "email" || f.type === "url" || f.type === "select"
                    ? (f.type as "email" | "url" | "select")
                    : ("text" as const),
                required: f.required === true,
              }))
              .slice(0, 12)
          : [];
        if (!fields.length) {
          warnings.push("dropped a form block with no fields");
          break;
        }
        blocks.push({
          type: "form",
          fields,
          ...(str(b.heading) ? { heading: str(b.heading, 120) } : {}),
          ...(str(b.body) ? { body: str(b.body, 600) } : {}),
          ...(str(b.submitLabel) ? { submitLabel: str(b.submitLabel, 40) } : {}),
        });
        break;
      }
      case "cta": {
        const title = str(b.title, 140);
        const ctaSrc = (b.cta ?? {}) as Record<string, unknown>;
        if (!title) {
          warnings.push("dropped a cta with no title");
          break;
        }
        blocks.push({
          type: "cta",
          title,
          ...(str(b.body) ? { body: str(b.body, 400) } : {}),
          cta: { label: str(ctaSrc.label, 40) || "Get started", href: str(ctaSrc.href, 300) },
        });
        break;
      }
      case "consent": {
        const clientName = str(b.clientName, 80);
        const scopes = Array.isArray(b.scopes)
          ? b.scopes.map((s) => str(s, 200)).filter(Boolean).slice(0, 12)
          : [];
        if (!clientName || !scopes.length) {
          warnings.push("dropped a consent block missing a client name or scopes");
          break;
        }
        blocks.push({
          type: "consent",
          clientName,
          clientDescription:
            str(b.clientDescription, 400) || "This application is requesting access to your account.",
          scopes,
        });
        break;
      }
      default:
        warnings.push(`dropped unknown block type "${String(b.type)}"`);
    }
  }

  const title = str(input.title, 160) || blocks.find((b) => b.type === "hero" && "title" in b)?.title || kind;

  return {
    spec: {
      kind,
      title,
      palette: resolvePalette(input.palette ?? input.theme),
      blocks,
      ...(str(input.brand, 80) ? { brand: str(input.brand, 80) } : {}),
      ...(input.meta && typeof input.meta === "object"
        ? {
            meta: Object.fromEntries(
              Object.entries(input.meta as Record<string, unknown>)
                .slice(0, 12)
                .map(([k, v]) => [str(k, 40), str(v, 200)])
                .filter(([k, v]) => k && v)
            ),
          }
        : {}),
    },
    warnings,
  };
}

export function priceToMicros(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1_000_000);
}
