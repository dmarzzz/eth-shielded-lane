# Native UTXOs on Ethereum (Nero_eth): primary-source notes

Last reviewed: 2026-09-17. Source: https://ethresear.ch/t/native-utxos-on-ethereum/25368 (posted 2026-07-06).

## The design

- Motivation: "For payment workloads that do not need persistent state, native UTXOs bring the permanent state usage down by roughly 99.8%."
- A UTXO is an opening `(source, value, recipient)` plus a protocol-assigned monotonic index. "The opening itself is not stored in state. It is only emitted in the creation event log, which makes the UTXO discoverable, and committed to a per-block openings root."
- Consensus state: `next_utxo_index`, a packed spent bitfield, `openings_root_ring[N mod 8192]`, sealed `batches[N / 8192]`, and a `UTXO_VAULT` address holding locked ETH.
- Split model, in the author's words: "We won't require everyone to keep track of the unspent UTXO set by holding all UTXOs in state. The permanent cost stops landing at creation and moves to consumption."
- Design principle: "Keep in state only the minimal fact the next transaction's validity depends on, usually just 'has this been used?', and push existence and contents into append-only history you prove against on demand."
- Spending uses EIP-8141 frames, not an opcode, because a zero-ETH recipient "cannot even begin execution, because the upfront balance check for intrinsic gas fails before SPEND_UTXO can run." Frames give self-funded spends ("The vault pays from the UTXO value being consumed") and trustless sponsorship.
- Three phases: VERIFY (read-only: signatures, opening path, spent bit unset, conservation), approval (check-and-set spent bits), settlement (cannot fail).
- 1-block minimum latency: the openings root exists only at block end.
- Cost: fresh account ~100-150 B permanent state; native UTXO ~0.3 B.

## Thread critiques worth carrying

- CPerezz: EIP-4444 pruning vs. proving old openings; sealing schedule unspecified; "the spec needs the invariant that batches[b] is readable in state no later than the first overwrite of an era-b ring slot." Also mempool identity under witness refresh, and pre-signed spends dying on reorgs that re-index creation.
- CPerezz asked: "is the vault/frame chassis meant as the base a future enshrined shielded pool would reuse?" Nero: stealth addresses suffice; ZK verification "would increase surface area, problems and complexity."
- leekt216: contract accounts cannot be UTXO recipients without keys; CREATE2 footgun.
- Po and WGlynn: the user must custody openings and paths; watchtower analogy; "the failure case isn't that retention is hard, it's that it's nobody's job."
- SanLeo461: free RPCs will not serve months-old logs or historical storage slots.
- Token leaf incompleteness (leaf lacks token field); Nero: "Yeah this would need to change."

## What we take from it

- The chassis: vault, openings-root ring, frames for gas abstraction.
- The transparent UTXO as the unshield target (ADR-0004).
- The 8192-block ring as the default root window.
- OQ-9 (history expiry) and OQ-13 (reorgs) come straight from this thread.
