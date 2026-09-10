/**
 * Auth Vault — encrypted-at-rest token storage for third-party integrations.
 *
 * Tokens are AES-256-GCM encrypted with `VAULT_CIPHER_KEY` (a Workers secret).
 * If the key is missing, values are stored base64 with a `plain:` prefix so
 * the vault degrades gracefully in local dev but NEVER claims to be secure.
 */

export interface VaultEnv {
  VAULT_CIPHER_KEY?: string;
}

export interface VaultToken {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
  scope: string | null;
  updated_at: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function cipherKey(env: VaultEnv): Promise<CryptoKey | null> {
  if (!env.VAULT_CIPHER_KEY) return null;
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.VAULT_CIPHER_KEY.padEnd(32, "0").slice(0, 32)),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
  return material;
}

export interface StoreTokenInput {
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at?: number | null;
  scope?: string | null;
}

export async function encryptSecret(env: VaultEnv, plain: string): Promise<string> {
  const key = await cipherKey(env);
  if (!key) return `plain:${b64(encoder.encode(plain))}`;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plain)
  );
  return `enc:${b64(iv)}:${b64(new Uint8Array(ct))}`;
}

export async function decryptSecret(env: VaultEnv, stored: string): Promise<string | null> {
  if (stored.startsWith("plain:")) {
    return decoder.decode(unb64(stored.slice("plain:".length)));
  }
  if (!stored.startsWith("enc:")) return null;
  const key = await cipherKey(env);
  if (!key) return null;
  const [ivB64, ctB64] = stored.slice(4).split(":");
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivB64).buffer as ArrayBuffer },
      key,
      unb64(ctB64).buffer as ArrayBuffer
    );
    return decoder.decode(plain);
  } catch {
    return null;
  }
}

export async function storeToken(
  db: D1Database,
  env: VaultEnv,
  input: StoreTokenInput
): Promise<void> {
  const id = `${input.user_id}:${input.provider}`;
  const encrypted = await encryptSecret(env, input.access_token);
  const encryptedRefresh =
    input.refresh_token != null ? await encryptSecret(env, input.refresh_token) : null;
  const now = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `INSERT INTO vault_tokens (id, user_id, provider, access_token, refresh_token, expires_at, scope, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at   = excluded.expires_at,
         scope        = excluded.scope,
         updated_at   = excluded.updated_at`
    )
    .bind(
      id,
      input.user_id,
      input.provider,
      encrypted,
      encryptedRefresh,
      input.expires_at ?? null,
      input.scope ?? null,
      now
    )
    .run();
}

export async function getToken(
  db: D1Database,
  _env: VaultEnv,
  user_id: string,
  provider: string
): Promise<VaultToken | null> {
  const row = await db
    .prepare("SELECT * FROM vault_tokens WHERE user_id = ? AND provider = ?")
    .bind(user_id, provider)
    .first<VaultToken>();
  if (!row) return null;
  return row;
}

export async function listTokens(db: D1Database, user_id: string): Promise<VaultToken[]> {
  return db
    .prepare("SELECT * FROM vault_tokens WHERE user_id = ? ORDER BY provider")
    .bind(user_id)
    .all<VaultToken>()
    .then((r) => r.results);
}