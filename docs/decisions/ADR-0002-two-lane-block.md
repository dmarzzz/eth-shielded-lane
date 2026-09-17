# ADR-0002: Two-lane block, not MCP-style merged execution

- Status: accepted
- Date: 2026-09-17
- Deciders: dmarzzz

## Context
The design goal is a builder-built payload plus a committee-built smaller block that "don't really need to affect each other." The MCP literature (Multiplicity, Neuder/Resnick, BRAID, a16z MCP, Price of Censorship) merges all proposers' bundles into one deterministic sequence executed once. Cross-bundle invalidation is an open problem in that literature.

## Decision
Structure the block as two lanes. Lane 1 is the ordinary execution payload. Lane 2 is the shielded lane: a set of shielded transfers appended after the payload, with its own commitment in the beacon block, its own gas budget, and an access set restricted to the shielded system contract. The lane is applied after the payload and commutes with it by construction (see ADR-0003, ADR-0004, ADR-0006).

## Alternatives
- MCP-style union with deterministic ordering: reintroduces state coupling and the free-DA problem.
- Put shielded transfers in the payload as normal transactions (EIP-8182 today): no aggregation, builder controls inclusion, per-tx verification.

## Consequences
- Requires a beacon-block field for the lane commitment, a lane validity function in clients, and a separate resource lane.
- The lane can be built during t=0..8s in parallel with the builder and committed under ePBS without the payload.
- Everything that is not a shielded-to-shielded transfer or a lane unshield stays in the payload.
