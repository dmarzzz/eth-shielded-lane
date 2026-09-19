# ADR-0008: Nullifier reveals happen only in the lane, so the lane and the payload are built in parallel

- Status: accepted; the withholding claim is made true by ADR-0011, and the deposit wording is replaced by ADR-0009
- Date: 2026-09-17
- Deciders: dmarzzz
- Resolves: OQ-7

## Context
The claim that the lane and the payload are built concurrently needs a precise dependency argument. Under ePBS (EIP-7732) the builder works on payload N+1 during slot N and reveals it at t=6 of slot N+1. Under FOCIL (EIP-7805) the committee works during slot N (t=0..8), views freeze at t=9, and the lane proposer must hand the lane to the proposer by t=11. The proposer commits to the builder's bid and the lane at t=0 of slot N+1.

What lane L(N+1) depends on:
1. Nullifier state after block N. Block N's lane L(N) was committed at t=0 of slot N, so it is known to everyone for the whole of slot N. If the payload of block N could also reveal nullifiers (EIP-8182-style inline transact), that part of the nullifier state would only be known at t=6 of slot N, after the payload reveal, leaving the committee two seconds before its t=8 broadcast.
2. A commitment root. Lane transactions anchor to any root in the ring, so they never need the freshest root. Block N's deposits (payload side) only add commitments and only matter to a transaction that chooses to anchor to end-of-N, which is spendable at N+2.

What payload N+1 depends on from the lane: nothing. It never reads shielded state. Deposits are queued and drained at block end.

## Decision
Nullifier reveals happen only inside the lane. The payload may deposit into the vault and may spend transparent UTXOs via frames, but it may not spend shielded notes. Inline mode (ADR-0004, alternative 1) is dropped.

Consequences for timing:
- The nullifier pre-state of L(N+1) is fully known at t=0 of slot N. The committee's whole window (t=0..8) is usable.
- Attesters validate L(N+1) during t=0..3 of slot N+1 using only L(N) and the ring. No dependency on payload N+1, which is unrevealed, and only a root dependency on payload N, which was executed by t=9 of slot N.
- If the builder withholds payload N+1, the lane still applies. The lane survives builder withholding.

## Alternatives
- Allow inline spends in the payload and resolve conflicts by "lane applied after payload, inline wins": correct, but it moves the lane's nullifier pre-state to t=6 of slot N and shrinks the committee's window.
- Allow inline spends but require them to anchor and reveal against a two-block-old state: adds a second nullifier window and complicates the spec for little gain.

## Consequences
- Atomic unshield-act-reshield in one payload transaction is no longer possible. The path is: lane unshield to a transparent UTXO at N, frame spend at N+1 (ADR-0004).
- OQ-7 closed. OQ-13 (reorgs) unchanged.
