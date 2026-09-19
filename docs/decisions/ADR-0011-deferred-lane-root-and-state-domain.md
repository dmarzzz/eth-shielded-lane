# ADR-0011: The lane's root is verified one slot late, and shielded state is its own domain

- Status: accepted
- Date: 2026-09-19
- Deciders: dmarzzz
- Amends: ADR-0008 (the withholding claim), ADR-0002, spec sections 4, 5, 6
- Source: docs/redteam-2026-09-19-crossings.md finding 1; docs/redteam-2026-09-19-consensus-alternatives.md findings 4, 5, 9

## Context
ADR-0008 claimed the lane still applies when the builder withholds the payload. Spec v0.1 applied the lane as an execution-layer state change after the payload and drained a queue the payload wrote. An ePBS EMPTY slot has no execution-layer block, no header and no state root, so the claim could not hold as written. Separately, committing the post-lane root in the same beacon block forces every attester to verify every proof before t=3.

With ADR-0009 shielded state is a pure function of the lane sequence, so whether a payload was FULL or EMPTY cannot change it. What is left to decide is where the bytes live and when the root is checked.

## Decision
1. Shielded state (notes tree frontier and root ring, nullifier set, credit outbox) is a third state domain. It is committed by `shielded_state_root` in the beacon state and is not part of the execution-layer account trie. An EMPTY slot therefore needs no execution-layer block for the lane to apply.
2. Beacon block N carries `lane[N]` (its op hashes; bodies travel as a sidecar on a lane gossip topic) and `shielded_state_root` as of the end of lane N-1. Attesters of block N check lane inclusion by hash (ADR-0010), that they hold the body of every op hash in the lane (availability, not validity), and the root for N-1, which they have had a full slot to compute. Proofs in lane N are verified after attesting and before attesting to N+1.
3. This is the deferral ePBS already applies to payloads, where the next proposer and the next slot's attesters are the first parties required to have validated payload N (EIP-7732: "The next proposer has 6 seconds ... to validate the payload and every other validator 9 seconds").
4. Storage is a client decision. The expected arrangement is that the execution client or a sidecar module holds the nullifier set and serves membership lookups to the consensus client over the engine API; only the root lives in `BeaconState`.
5. Mailboxes across EMPTY slots follow Gloas. Deposit roots are read only from payloads the beacon state records as FULL (the existing parent-FULL/EMPTY branch used for execution requests). Credits stay in the outbox until a FULL payload pays them, as withdrawals do.

## Alternatives
- Put the whole shielded state in `BeaconState`: the v0 nullifier set grows by up to about 18 GB per year at the lane's ceiling (110 ops per slot, 2 nullifiers, 32 bytes; arithmetic, not measured), which is incompatible with how consensus clients hold and hash state.
- Keep shielded state in the execution-layer trie and define a lane-only execution block for EMPTY slots: changes ePBS empty-slot semantics for every client.
- Commit the post-lane root in the same block: puts pairing checks back before the attestation deadline.

## Consequences
- The withholding claim in ADR-0008 becomes true: a withheld or invalid payload delays deposits and credits and changes nothing else.
- A wrong `shielded_state_root` in block N is a proposer fault detectable by every attester of N, with a slot of slack. It invalidates block N, not lane N-1.
- Light clients of the shielded state see roots one slot late.
- Checkpoint sync must fetch the nullifier set (v0) or the window (v2). This is new sync surface for consensus clients. OQ-6 gains this line.
- The engine API gains a lane-apply call and a nullifier-lookup call. C2 in the first red team (the undrawn CL/EL split) is answered by this ADR.
