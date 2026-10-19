/**
 * PRICE_TABLE — the locked 35-tool price list from brief-001, exported for the
 * audit and for anything that needs the table outside the tool registry.
 *
 * The registry (src/api/tools.ts) stays the single source of truth; this
 * module mirrors it as data, and test/x402.test.ts asserts the two agree so
 * they cannot drift.
 */

import { TOOL_DEFS } from "../api/tools";
import { toAtomicUnits } from "./x402";

/** Category groupings used by the audit. */
export const TOOL_CATEGORIES = [
  "orchestration",
  "pages",
  "communication",
  "research",
  "inference",
  "creative",
  "automation",
  "commerce",
  "memory",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** One priced tool. */
export interface PricedTool {
  /** Registry name. */
  name: string;
  /** Name on the MCP execution surface; null for catalog-only tools. */
  mcp_name: string | null;
  category: string;
  status: string;
  description: string;
  price_usd: number;
  /** Price in 6-decimal USDC atomic units, as charged on the wire. */
  price_atomic: string;
  /** Live tools are callable now; planned and stub are catalog entries. */
  on_execution_surface: boolean;
}

/**
 * Every tool in the registry, ordered as the registry lists them.
 *
 * Includes tools priced at $0. A free tool is still a catalogue entry an agent
 * discovers and can call without paying, so dropping it here would make the
 * discovery document and this table disagree about what exists.
 */
export const PRICE_TABLE: readonly PricedTool[] = Object.freeze(
  TOOL_DEFS.map((tool) =>
    Object.freeze({
      name: tool.name,
      mcp_name: tool.mcpName ?? null,
      category: tool.category,
      status: tool.status,
      description: tool.description,
      price_usd: tool.x402_price_usd,
      price_atomic: toAtomicUnits(tool.x402_price_usd),
      on_execution_surface: Boolean(tool.mcpName),
    })
  )
);

/** Look up one tool by registry name. */
export function pricedTool(name: string): PricedTool | null {
  return PRICE_TABLE.find((tool) => tool.name === name) ?? null;
}

/** Tools grouped by category, for the audit document. */
export function priceTableByCategory(): Record<string, PricedTool[]> {
  const grouped: Record<string, PricedTool[]> = {};
  for (const tool of PRICE_TABLE) {
    (grouped[tool.category] ??= []).push(tool);
  }
  return grouped;
}

/** The table as plain text rows: name, category, price, atomic. */
export function priceTableRows(): string[] {
  return PRICE_TABLE.map(
    (tool) =>
      `${tool.name.padEnd(28)} ${tool.category.padEnd(14)} $${String(tool.price_usd).padEnd(9)} ${tool.price_atomic.padStart(10)}  ${tool.on_execution_surface ? "live" : tool.status}`
  );
}
