# ADR-0012: One design, delivered as a sequence of EIPs

- Status: accepted
- Date: 2026-09-19
- Deciders: dmarzzz
- Resolves: OQ-14

## Context
EIP-8182 was declined for Hegotá on 2026-09-14 in favor of the frames path (EIP-8141, EIP-8250, EIP-8272, with FOCIL). A shielded lane enshrines more than 8182 did, so pitching it as one EIP for one fork is not credible. The design does decompose: each piece is useful without the ones after it, and the early pieces are already scheduled.

## Decision
The shielded lane is presented as one target design that switches on in stages, each stage its own EIP or set of EIPs.

| Stage | What ships | Status of the pieces | What it buys by itself |
|---|---|---|---|
| 0 | A shielded pool as a contract on frames, with nullifiers as keyed nonces and FOCIL forcing inclusion | EIP-7805 and EIP-8141 SFI for Hegotá; EIP-8250 and EIP-8272 PFI | Relayer-free private transfers with FOCIL-grade inclusion. No new consensus code |
| 1 | A gas carve-out that only inclusion-list transactions can consume | new, small amendment to EIP-7805 | Closes FOCIL's block-full excuse for every listed transaction, private or not |
| 2 | The two mailboxes and the shielded state domain: payload-written deposit tree, lane-written outbox paid as system credits, shielded state root in the beacon state | new; reuses the EIP-7685 and EIP-4895 patterns | Single-writer state (ADR-0009, ADR-0011). Exits with no user transaction |
| 3 | The lane: lane inclusion lists, the committee duty, per-op validity, the beacon block fields | new; amends EIP-7805 | Builder-free inclusion for shielded ops with their own resource budget (ADR-0010) |
| 4 | v2: one aggregate proof per lane and windowed nullifiers | research (OQ-1, OQ-2, OQ-3) | The state and verification costs stop growing with usage |

Constraint that makes the staging real: the note format, the nullifier derivation (including the tree tag) and the deposit leaf format are fixed at stage 0, so the stage 0 pool's notes are the lane's notes and the anonymity set carries across every stage without a migration.

## Alternatives
- Pitch the lane as one EIP: the fork just declined a smaller version of that.
- Pitch only the state model: drops the inclusion argument, which is the part of the thesis that is about builders.
- Stop at stage 1: legitimate outcome. If measurement after stages 0 and 1 shows private transfers are included reliably and cheaply, stages 3 and 4 need a new justification.

## Consequences
- Each stage has its own exit criterion and can be argued on its own.
- Stage 0 depends on nothing this dossier invents.
- The thread and README describe the end state and say plainly that it arrives in pieces.
