# ADR-0007: FOCIL committee lists lane transactions; attesters reject a lane missing any listed transaction

- Status: accepted; amended by ADR-0010: inclusion is checked by op hash only, a listed op is never excused, and an invalid listed op applies as a no-op. "Valid if appended" is no longer evaluated by attesters
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
Someone has to assemble and (in v1/v2) prove the lane. That role can censor. FOCIL already gives Hegotá a 16-member committee that lists transactions and a validity rule that checks whether a missing transaction "would be valid if appended to the end of the payload."

## Decision
Committee members include lane transactions in their inclusion lists (full transactions, within the 8 KiB limit, or a lane-specific list). A lane proposer assembles the lane and produces the aggregate where applicable. Attesters reject the block if any committee-listed lane transaction is absent from the lane and would have been valid, where validity is the lane's own check (anchor in ring, nullifiers not in window, proof verifies). Because the lane commutes, "valid if appended" reduces to that check.

## Alternatives
- Slot proposer builds the lane with no committee: single point of censorship.
- Each committee member proves and submits their own sub-lane: 16 sub-lanes per block; viable as v1 and avoids a single aggregator, at the cost of duplicate handling.

## Consequences
- Reuses the Hegotá mechanism with no new committee.
- Aggregation is deterministic over the set, so a withheld lane is rebuildable by anyone with the transactions.
- Aggregator identity, payment, and equivocation handling remain open (OQ-3).
