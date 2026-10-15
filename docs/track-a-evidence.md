# Track A evidence — discoverability, transaction, replay (brief-004)

Proofs live in `test/track-a-proofs.test.ts`. The client in that file knows
nothing about the server beyond its origin: no tool names, no prices, no
endpoint layout. It is the same transport a third-party MCP client would use.

Run without a key (local facilitator, no money moves):

```
npx vitest run test/track-a-proofs.test.ts
```

Run against the public testnet facilitator (real settlement):

```
X402_BUYER_PRIVATE_KEY=0x… npx vitest run test/track-a-proofs.test.ts
```

## 1. Discovery — all 35 tools, priced, from the Bazaar documents

The agent reads the Bazaar discovery extension published on `tools/list` and
rebuilds the catalogue. Every price it learns is compared against the locked
table; the 13 tools that are on the execution surface are then each challenged
for a 402, and the challenge must repeat the same document, amount, network and
asset.

```
discovered 35 tools via Bazaar documents (13 callable now), facilitator https://x402.org/facilitator
```

**Live index status:** the public x402.org facilitator does not advertise the
`bazaar` extension — its `/supported` lists `builder-code`,
`eip2612GasSponsoring` and `erc20ApprovalGasSponsoring` only. So no public Bazaar
registry indexes this resource yet, and the documents are read from our own 402
challenges and catalogue. The mechanism is wired and proven; being *listed*
needs a facilitator that indexes Bazaar.

## 2. Transaction — 402 → pay → verify → settle → 200

```
402→200 in 2242ms (attempts: 200@2242ms), replay in 1ms,
tx=0xab9ca4709f1799ad049b4760b7a1d7288fff0cad63e7e5135a5f00e29b989aab (testnet)
```

On-chain, Base Sepolia block 48130783:

```
status  SUCCESS
USDC    0x7099…79C8 → 0x1111…1111   0.005000 USDC
```

**Timing: 2.2 s, target under 10 s.** Where it goes: the buyer signs locally
(~1 ms), the facilitator verifies (~1 s round trip) and then settles (~1 s
on-chain broadcast). The facilitator is the bottleneck; our own work is
negligible. Measured 402→200 across runs: 2.0 s, 2.2 s, 3.5 s.

The public facilitator resets connections intermittently, so the proof retries
with a *fresh* authorization and reports the attempt count — a retry never
reuses a spent nonce, and a retry without an idempotency key would cost the
buyer a second payment, which is what item 3 is about.

## 3. Replay — one payment, one delivery

Two distinct replays, both proven:

**Same idempotency key** — the retry is served from the record written at
settlement, byte-identical, in ~1 ms, with `x402-idempotent-replay: true`, and
the facilitator is never asked again.

**The same signed authorization** — sent again with no idempotency key at all:

```
first payment settled: 0x62560fcbad8ad0539c424105c1fbaa284b634337ede3e9f19b76a3a0a10baaa5
replay of the same authorization: 402, no second settlement, no second delivery
```

On-chain, block 48130784: `SUCCESS`, `0.005000 USDC` to the recipient — once.

The replay is refused at settlement (`invalid_exact_evm_transaction_failed`):
the EIP-3009 nonce was already consumed, so the facilitator cannot move the
money twice even though the buyer replayed a signature our own verification
accepted. Two independent layers, exactly the failure mode from the parked
findings: a blind retry after payment cannot double-charge.

## What the live proofs do not claim

They ran with the well-known public Anvil test key, not the owner's funded
wallet, because `X402_BUYER_PRIVATE_KEY` is not in the environment. They prove
the rail, the prices, the discovery and the replay protection — not a real
buyer's wallet. No Hardhat key appears in production code; both live test
files read the key from the environment and fall back to the public testnet key
only when none is set.
