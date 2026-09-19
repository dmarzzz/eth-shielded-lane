# ADR-0006: Fees paid from shielded value; separate lane gas budget

- Status: accepted; amended by ADR-0009: base-fee burn and tips are settled by the payload side when it pays the outbox, the lane never writes a balance
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
If lane transactions paid gas from an account, the lane would read account balances and nonces, coupling it to the payload. FOCIL's conditional rule lets a builder drop IL transactions when the block is full.

## Decision
Every lane transaction pays its fee from the value it consumes (EIP-8182's reserved fee-note slot, or Nero's vault-pays pattern). Base fee is burned from vault balance; the tip goes to the lane proposer. The lane has its own gas budget and its own base fee, priced per transaction shape.

## Alternatives
- Account-paid gas: couples the lane to the payload.
- Share the payload's gas limit: reopens the "block full" loophole and makes lane inclusion compete with MEV.

## Consequences
- The lane never reads an EOA.
- "Block full" is per-lane, so FOCIL's escape hatch cannot be used against lane transactions.
- Uniform per-shape pricing removes a fee-based fingerprint.
- Needs a fee-market spec (OQ-4).
