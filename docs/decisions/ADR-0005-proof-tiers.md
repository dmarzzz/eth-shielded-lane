# ADR-0005: Ship v0 with per-tx Groth16 batch-verified; design for a single aggregate with windowed nullifiers

- Status: accepted
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
Tachyon's aggregation runs on Halo/IPA over Pasta with no Ethereum verifier path and no published benchmarks. EIP-8182 uses Groth16 BN254, which Ethereum can verify today. The "nodes don't sync the state" property needs recursion (users prove non-membership of old nullifiers), which v0 cannot provide.

## Decision
- v0: each lane transaction carries its own Groth16 BN254 proof. The client verifies them natively as a batch during lane validation. Consumption state is a permanent nullifier set, the same cost as EIP-8182. (An earlier draft said "spent bitfield"; that only works for protocol-indexed UTXOs, not for user-derived nullifiers. Corrected after red team.)
- v1: one aggregate per committee member (16 per block), non-recursive.
- v2: one aggregate for the lane plus a nullifier window. Users carry PCD non-membership proofs for nullifiers older than the window. Proof system TBD (OQ-1).

## Alternatives
- Wait for Ragu: blocks the whole design on an unaudited stack with no verifier path.
- Hash-based from day one (Pierre's position): PQ-clean but no verifier path and larger proofs.

## Consequences
- v0 is buildable with existing primitives and gets the inclusion and independence properties immediately.
- v0 does not get the pruning property. That is stated plainly in any post.
- v2 changes the note format and nullifier derivation (Tachyon's inversion, out-of-band payments), not only the state model. The lane's block placement and inclusion rule carry over; the note semantics do not. Users and wallets migrate.
