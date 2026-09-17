# ADR-0001: Base pool semantics on EIP-8182

- Status: accepted
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
Three candidate bases exist for the shielded side: EIP-8182 (system-contract shielded pool, Groth16 BN254, PFI for Hegotá), EIP-7503 (burn-and-mint wormhole, stagnant, one hop only), and a from-scratch Tachyon port (Halo/IPA over Pasta, no Ethereum verifier path). EIP-8182's author has stated on the magicians thread that "the unavoidable issue is still unprunable nullifier-type data" and has not answered a question about proof aggregation.

## Decision
Use EIP-8182's note structure, commitment tree, fee-note pattern, and split pool/auth proofs as the pool semantics. Replace its state model (permanent nullifier mapping) and its execution model (one verified proof per payload transaction) with the lane.

## Alternatives
- EIP-7503 as base: elegant anonymity set (all ETH sends) but no in-pool transfers, so no shielded-to-shielded payments.
- New pool from Tachyon: cleanest state model but no verifier path on Ethereum today and no audited proof stack.

## Consequences
- The proposal can be framed as an EIP-8182 v2 state and inclusion model rather than a competing pool.
- We inherit 8182's leafIndex-in-commitment, which forces the deposit-ordering rule in ADR-0003.
- We inherit the trusted-setup question for v0.
