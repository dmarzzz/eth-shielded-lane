# ADR-0010: Validity is per op; a lane cannot be invalid

- Status: accepted
- Date: 2026-09-19
- Deciders: dmarzzz
- Amends: spec sections 3, 4, 7; ADR-0007
- Source: docs/redteam-2026-09-19-consensus-alternatives.md findings 3, 4, 6; docs/redteam-2026-09-17.md F1, L1

## Context
Spec v0.1 said a lane containing any nullifier conflict is INVALID (section 3) and that attesters MUST reject a lane that omits a listed op whose nullifiers were unspent as of end of N-1 (section 7). A user who sends op A to one committee member and a conflicting op A' to another makes both rules unsatisfiable at once. No valid block exists for the slot, and the attack costs one note. More generally, any rule of the form "one bad op invalidates the lane" lets a committee member or a user orphan the proposer's block and the builder's bid at almost no cost, and it forces attesters to verify SNARKs before the 3 second attestation deadline.

FOCIL does not have this problem because it evaluates an omitted transaction against the state after the block, where the second of two same-nonce transactions is simply no longer includable.

## Decision
1. A lane is an ordered list of candidate ops. Order is canonical: by (committee member index, position in that member's list), duplicates removed by op hash.
2. Validity is decided per op, at apply time, in lane order. An op is a no-op if its proof fails, an anchor is outside its ring, any of its nullifiers is already in the nullifier set, or any of its nullifiers was revealed by an earlier op in the same lane. A no-op writes nothing, pays nothing, and occupies no leaf positions. The first op in canonical order wins a conflict.
3. This is safe at v0 because EIP-8182 proofs bind the note body commitment and leaf positions are assigned at insert. Skipping an op shifts nothing that any prover committed to.
4. The inclusion rule is by hash only: attesters MUST reject a block whose lane omits the hash of an op that appeared in a committee list they saw before the view freeze. No proof is verified and no state is read to check inclusion. An invalid listed op is harmless, so the proposer has no excuse to omit it.
5. Committee members MUST verify an op before listing it. Lists are signed, so a listed no-op is attributable to its lister.
6. Lane mempool nodes apply a first-seen rule per nullifier: an op that reveals a nullifier already seen in a pending op is not relayed.
7. Listers are partitioned. Member `i` is a primary lister for an op when `min(op.nullifiers) mod 16` falls in member `i`'s window of width `r`. Each op is listable by exactly `r` members. `r` is a protocol constant, initial value 3.

## Alternatives
- Minimal patch: keep invalid lanes, excuse an omitted op if any of its nullifiers is spent in the lane. Fixes the two-lister attack, keeps proof verification on the attestation path, keeps "one bad proof orphans the block".
- Charge the losing op of a conflict: not possible. Its fee was payable only from the note the winning op already spent.
- Let the proposer choose among conflicting ops: reintroduces proposer discretion inside the lane for no benefit.

## Consequences
- No user and no single committee member can make a block invalid through lane content.
- SNARK verification leaves the attestation critical path (see ADR-0011 for when it happens).
- Griefing is bounded, not priced: one note can occupy at most `r` list slots for one fee. A malicious lister can waste at most its own 8 KiB per slot, as in FOCIL today.
- Throughput rises from roughly one list's worth of ops (16 near-duplicate lists) to `16 / r` lists' worth.
- Censorship resistance of a given op falls from 1-of-16 honest listers to 1-of-`r`. This is the knob; OQ-18 opens on its value.
- This does not carry to a v2 single aggregate proof, where the aggregate is over a fixed op set. v2 needs its own rule (the aggregator proves the no-op set, or aggregates only winners and the inclusion rule excuses proven losers). OQ-3 absorbs this.
