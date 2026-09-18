# ADR-0000: Partition the block by contention

- Status: accepted
- Date: 2026-09-17
- Deciders: dmarzzz
- This is the founding decision. Every later ADR is an application of it.

## The observation
MEV is not a property of transactions. It is a property of contention. When many actors reach for the same state in the same block, the order they land in is worth money, and someone captures that value. The more contention, the more ordering is worth, the more it pays to be a specialist at it. Block builders exist because ordering contentious state well is a real skill with real economies of scale. ePBS is Ethereum accepting this and keeping validators out of it.

Multiple concurrent proposers (MCP) is a censorship-resistance idea that fights that fact head on. Split a contentious block across many proposers and their outputs still have to be merged into one order. Every published MCP design does exactly this (Multiplicity, the Neuder/Resnick two-proposer post, BRAID, the a16z construction, the "Price of Censorship" model: union of sub-blocks, deterministic order, one execution). The merge rule then becomes the thing to game, and an out-of-protocol market to backrun the merged block is the predictable result. MCP over contentious state does not remove the specialist; it moves the specialist outside the protocol.

A shielded transfer is the one common workload with no contention at all. It burns a nullifier only the spender can derive, appends a commitment to an append-only tree, and moves value inside a vault. It reads no account, no contract, no price. Two shielded transfers can only conflict if one is a double spend, which is the spender's own fault and is detected by a set lookup. There is no ordering value. Nothing to front-run, sandwich, or backrun. No MEV, so no builder is needed, so a committee of ordinary validators can include them with no loss of efficiency, because there was no efficiency for a specialist to add.

## The decision
Partition the block by contention.

- Contentious state (the EVM, DeFi, everything that reads shared state) stays with the builders. This keeps the market structure that PBS/ePBS built and the efficiency it brings.
- Non-contentious state (shielded transfers) goes to a committee. This gets censorship resistance from many proposers, which is exactly where MCP is free instead of expensive.
- The two lanes never depend on each other's contents for validity. The only places MEV can appear are the crossings (deposit, unshield), and those are routed through the builder's lane on purpose, so contention stays with the contention specialists.

## The bet
Scaling an execution environment scales contention, and with it the extraction market, the builder centralization pressure, and the pipeline complexity. Scaling shielded payments scales proof verification and data availability, both of which aggregate (one proof per block) and prune (Tachyon-style windows). That is why private payments are the workload that can grow toward civilization scale without the growth itself creating a new market to extract from. This is stated as a bet, not a theorem.

## What this rules out
- MCP over the payload. Rejected in ADR-0002 for the reason above.
- Shielded spends inside the payload (ADR-0008): they would drag the non-contentious workload back into the contentious lane.
- Any lane feature that reads EVM state. If it can be contended, it does not belong in the lane.

## What this borrows
Zcash shows the path to scalable private transfers (Tachyon). FOCIL/MCP shows a path to scalable censorship resistance. ePBS keeps the builders. The design is the observation that these three never compete for the same job.
