# ADR-0003: Lane anchors to roots as of block N-1; deposits drain at block end

- Status: accepted
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
For the lane's validity to be independent of the payload, its pre-state must not depend on anything the builder does in block N. Payload deposits append to the same commitment tree. EIP-8182 binds `leafIndex` into the note commitment, so lane output indices would depend on how many deposits the builder included.

## Decision
Lane transactions prove membership against a commitment root as of the end of block N-1 or older (within the ring). Payload deposits in block N are queued and drained into the tree at block end, after lane outputs are inserted. Insert order within block N: lane outputs, then queued deposits.

## Alternatives
- Deposits inserted inline and lane outputs after: lane proofs depend on the builder's deposit count.
- Drop leafIndex from the commitment (Zcash style): possible, but diverges from 8182 and needs a different uniqueness source.

## Consequences
- Deposits become spendable in the lane at N+1 (one-block delay, same as Nero's model). OQ-5.
- The lane's pre-state is known at slot start.
