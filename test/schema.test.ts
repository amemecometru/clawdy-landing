import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "../src/db/schema";

const EXPECTED_TABLES = [
  "campaign_leads",
  "campaign_messages",
  "professional_campaigns",
  "professional_site_sections",
  "professional_sites",
  "professional_subscriptions",
  "professionals",
  "sessions",
];

function applyAndList(sql: string): string[] {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(sql);
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    return rows.map((row) => row.name);
  } finally {
    db.close();
  }
}

describe("professional brand schema", () => {
  it("creates every required table at runtime bootstrap", () => {
    const tables = applyAndList(SCHEMA_SQL);
    for (const table of EXPECTED_TABLES) {
      expect(tables).toContain(table);
    }
  });

  it("matches the 0005 migration file", () => {
    const migration = readFileSync(
      new URL("../migrations/0005_professional_brand_sites.sql", import.meta.url),
      "utf8"
    );
    const tables = applyAndList(migration);
    for (const table of EXPECTED_TABLES) {
      expect(tables).toContain(table);
    }
  });

  it("enforces tier + status constraints", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("PRAGMA foreign_keys = ON;");
      db.exec(SCHEMA_SQL);
      db.prepare(
        "INSERT INTO sessions (sub, email, name) VALUES ('sub_1', 'a@b.co', 'A')"
      ).run();
      expect(() =>
        db
          .prepare(
            `INSERT INTO professionals
              (id, owner_sub, first_name, last_name, email, current_role, target_role, tier)
             VALUES ('prof_1', 'sub_1', 'Jane', 'Doe', 'jane@x.com', 'Analyst', 'Engineer', 'platinum')`
          )
          .run()
      ).toThrow();
      expect(() =>
        db
          .prepare(
            `INSERT INTO professionals
              (id, owner_sub, first_name, last_name, email, current_role, target_role, status)
             VALUES ('prof_2', 'missing_sub', 'Jane', 'Doe', 'jane@x.com', 'Analyst', 'Engineer', 'lead')`
          )
          .run()
      ).toThrow();
    } finally {
      db.close();
    }
  });
});
