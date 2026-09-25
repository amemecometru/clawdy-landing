export interface SessionIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

export async function ensureSessionIdentity(
  db: D1Database,
  identity: SessionIdentity
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO sessions (sub, email, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         updated_at = excluded.updated_at`
    )
    .bind(identity.sub, identity.email, identity.name, now, now)
    .run();
}

export async function sessionIdentityExists(db: D1Database, sub: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS present FROM sessions WHERE sub = ?").bind(sub).first<{
    present: number;
  }>();
  return row !== null;
}
