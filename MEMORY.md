# MEMORY.md — durable project facts

Facts that must survive a context reset. Anything not here or in `briefs/`
is not recorded anywhere.

> **This repo is the live one.** `/home/book/clawdyclaw` is an older clone of
> the same GitHub remote (`clawdyclaw-landing`), stuck at `30be081` and
> **missing `wrangler.jsonc`** (gitignored there). Do not audit secrets there —
> a whole class of variables is invisible without `wrangler.jsonc`.

---

## 1. Where config actually lives

- `wrangler.jsonc` — bindings + non-secret `vars` (committed here).
- `.env` — scratch notes only, gitignored.
- **Cloudflare dashboard** — where the real x402 config lives. `wrangler.jsonc`
  contains **zero** `X402_*` keys, so nothing about the payment rail is
  version-controlled. `grep -c X402_ wrangler.jsonc` → `0`.

There is no Cloudflare credential on this machine: `CF_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` are referenced in `src/index.ts:48-50` but unset, and
`~/.wrangler/config` is absent. **`wrangler login` then `wrangler secret list`
is the only way to audit the live secrets.**

### `.env` is a notes file, not config

`clawdy-landing/.env` holds `github_pat_token`, `stripe_secret`, and two bare
addresses with no `key=value` pairs. **No `X402_*` keys, no private key.** Keep
it that way.

---

## 2. x402 secret inventory

| Name | Secret? | Notes |
|---|---|---|
| `X402_PAY_TO_ADDRESS` | **No — public** | Serialized into the `PAYMENT-REQUIRED` header of every 402 and handed to every buyer. Belongs in a dashboard **Variable**, not a Secret. |
| `X402_FACILITATOR_URL` | No | Dashboard secret or var; both fine. |
| `X402_NETWORK` | No | `base-sepolia` (default) or `base`. |
| `X402_MAINNET` | No | Exactly `true` required for `base`; otherwise fails closed to testnet (`src/lib/x402.ts:208`). |
| `X402_BUYER_PRIVATE_KEY` | **Yes** | **Local `.env` only. Never in Cloudflare.** |

### Rule: no private key in the Worker, ever

Nothing in `src/` calls `withX402Client()`. The seller Worker never signs
anything — it builds the 402 and hands verify/settle to the facilitator, which
holds no key. A `payTo` recipient needs **only an address**. Putting a key in
the Worker would create a funded hot wallet reachable by the public internet
for no benefit. The production secret set should contain **zero private keys**.

### Settle rails (`src/lib/x402.ts:71-80`)

| Network | CAIP-2 | Asset |
|---|---|---|
| `base-sepolia` (default) | `eip155:84532` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| `base` (+ `X402_MAINNET=true`) | `eip155:8453` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Both USDC, 6 decimals. Facilitator default is
`https://facilitator.payai.network` (`src/lib/x402.ts:93`, uncommitted).

---

## 3. Wallet addresses

All balances below verified on-chain Oct 16 2026 via public RPC.

| Address | Role | Base USDC | Base ETH | Notes |
|---|---|---|---|---|
| `0x6f625c1A7b2E79f4F842dc597A7727b422a72BA7` | **Phantom — revenue `payTo`** | **15** | 0 | Recorded in `phantom-base`. USDC confirmed at `0x833589fC…2913`. Not a public test account. |
| `0x811ead356a97d9607a37421ebd7133a474292e08` | Robinhood self-custody wallet | 19 | 0 | Source of the transfer. Still holds a balance. |
| `0x7f4dcad0802ed4fa1fc0dc95f24d87c3bfe682fc` | Testnet buyer wallet | — | — | Base **Sepolia**. |

Nothing is held on Ethereum mainnet — all balances were zero there.

**No revenue wallet existed before Oct 16 2026.** The clone's `.env` pointed
`X402_PAY_TO_ADDRESS` at the *testnet buyer wallet*, so testnet settlements paid
that wallet back into itself.

### The `payTo` address needs no ETH

In x402 the **facilitator** submits and pays the gas; the recipient never does.
So the Phantom address staying at 0 ETH is correct and does not block settlement.
ETH is only needed when *sending* funds manually — which is why the Robinhood →
Phantom transfer failed while both held 0 ETH.

### Unreconciled

Robinhood showed 19 USDC; Phantom received 15. **$4 unaccounted for.** Gas cannot
explain it (a Base USDC transfer is ~$0.001). Either only 15 was sent, or a
partial send failed silently. Resolve before treating Phantom as fully funded.

`0x811ead…92e08` is **not** one of the 20 public Hardhat/anvil accounts
(verified via viem, self-tested against hardhat #0) and appears in no commit in
either repo. That clears it of the "published test key" class of risk only.

### Traps

- `X402_BUYER_PRIVATE_KEY` in the clone's `.env` holds `0x811ead…92e08` — **an
  address, not a key**. 42 chars, not 66. `privateKeyToAccount()` throws on it.
- `test/zz-proof.test.ts` hardcodes test private keys. Testnet-only.
- `0xab9ca470…` and `0x62560fcb…` in `docs/track-a-evidence.md` are
  **transaction hashes**, not wallets. Don't wire them anywhere.

---

## 4. PayAI

`https://facilitator.payai.network` — the facilitator, **not** a funding gate
or a payment processor. Swapped in because the public `x402.org` facilitator
failed ~1 call in 3. See `briefs/brief-pricing-facilitator-live.md` Part 2.

Still unverified: the **$12 minimum-funds requirement** and the **"PayAI"** name
being attached to it. That may be a conflation of the two. Confirm before
acting.

---

## 5. `PAYMENT_CURRENCY` / `PROTECTED_PATTERNS` — WRONG CHAIN

`wrangler.jsonc:77-84`:

```
"PAYMENT_CURRENCY": "0x20c000000000000000000000b9537d11c60e8b50"
"PROTECTED_PATTERNS": [{ "pattern": "/api/*", "amount": "0.01", ... }]
```

`0x20c0…e8b50` is **USDC.e on Tempo (chain 4217)**, confirmed against viem's
token list (`usdce`, 4217), Tempo's docs, and Allium's Tempo MPP reference.

**It is not Base USDC.** The rail settles `0x833589fC…2913` on `eip155:8453`.
Two different chains, two different contracts.

**No code reads either var** — `grep` across `src/` and `test/` returns
nothing. They sit beside `AI_GATEWAY_URL`, so they were likely set up for
**AI Gateway Machine Payments** (buyer pays for inference) rather than for this
Worker's own x402 rail. Either they are inert, or a Cloudflare product reads
them. Decide before deleting.

---

## 6. Unverified — do not assume

- **$12 minimum-funds requirement** — processor unnamed, rule unconfirmed.
- **ETH for gas.** USDC settles via EIP-3009, which costs ETH. An all-USDC
  wallet reverts every settlement. The most likely silent mainnet failure.
- **`0x811ead…92e08` custody type.** The Robinhood app shows a 12-word phrase,
  which indicates **self-custody** — so Robinhood cannot recover it if lost.
- **Facilitator for mainnet** — PayAI is verified for testnet; mainnet use of a
  third-party facilitator over real funds is an unexamined dependency.

## 7. Handling rules

- **Never** paste a 12-word seed phrase or private key into chat, a repo, a
  commit, a dashboard field, or `.env`.
- Only `.env` and `.dev.vars` are gitignored. `.env.example` is committed and
  must never hold a real value.
- `clawdyclaw` (the clone) is stale and missing `wrangler.jsonc`. Don't trust
  it as a source of truth for anything.