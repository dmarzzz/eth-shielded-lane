# ADR-0004: Unshield into a transparent UTXO, not an account credit

- Status: superseded by ADR-0009 (unshield is a system credit from a lane-written outbox; alternative 2 below, with a turnstile)
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
Getting value from the shielded set back into public state is the one place the lane must touch something the payload also touches. Options: (1) inline CALL as in EIP-8182, (2) balance credit with CL-withdrawal semantics, (3) queued withdrawal drained at the start of N+1, (4) emit a transparent UTXO in Nero's format.

## Decision
A lane unshield emits a transparent UTXO: an opening `(recipient, value)` appended to the vault's openings tree with the next index. The lane writes no account state. The recipient spends the UTXO one block later in the payload via a frame transaction (EIP-8141) with self-funded gas, settling into an account or into new UTXOs.

## Alternatives
- (1) Inline CALL: atomic unshield-act-reshield composability, but arbitrary EVM inside the lane breaks independence and lets the builder front-run. Kept as an optional payload-side mode (OQ-7).
- (2) Balance credit, no code execution, no receive hook: lane-safe and needs no Nero. Touches balances additively. Fallback if native UTXOs do not ship.
- (3) Queued withdrawal: same as (2) with a one-block delay.

## Consequences
- The lane's access set is exactly the shielded system contract plus the vault. BALs can express this.
- Zero-ETH recipients can spend without gas (frames pay from the UTXO).
- Amount and recipient are public at the crossing in every option; denominations and fresh addresses are wallet policy.
- Depends on the Nero chassis or an equivalent minimal transparent-UTXO structure shipping.
