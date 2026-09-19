# ADR-0000: Partition the block by contention

- Status: accepted
- Date: 2026-09-17
- Deciders: dmarzzz
- This is the founding decision. Every later ADR is an application of it.

## The observation
People trying to access the same state is what creates MEV. That is why builders exist. When many actors reach for the same state in the same block, the order they land in is worth money, and someone captures that value. Ordering contentious state well is a real skill with real economies of scale, and ePBS is Ethereum accepting that and keeping validators out of it. With innovations like propAMM prioritization and JIT routing (Quintus's work at Flashbots), the builder's role will continue to be important for improving blockchains' ability to facilitate applications like exchanges.

Multiple concurrent proposers (MCP) is a censorship-resistance idea aimed straight at that fact. Split a contentious block across many proposers and their outputs still have to be merged into one order. Every published MCP design does exactly this (Multiplicity, the Neuder/Resnick two-proposer post, BRAID, the a16z construction, the "Price of Censorship" model: union of sub-blocks, deterministic order, one execution). The merge rule becomes the thing to game, and an out-of-protocol market to backrun the merged block is the predictable result. MCP over contentious state does not remove the specialist. It moves the specialist outside the protocol.

So on their own, MCP and encrypted mempools are not bullish for this design. They limit the market potential for markets built on top of Ethereum. It is a valid opinion to say let's not care about market efficiency for trading tokens and stocks on Ethereum in favor of decentralization. But then at that point let's give up the complexity and just do private transfers like Zcash.

The core insight runs the other way. MCP is amazing for something with low state contention, because there is less incentive to build out-of-protocol markets to game MCP. A shielded transfer is the one common workload with no contention at all. It burns a nullifier only the spender can derive, appends a commitment to an append-only tree, and moves value inside a vault. It reads no account, no contract, no price. Two shielded transfers can only conflict if one is a double spend, which is the spender's own fault and is caught by a set lookup. There is no ordering value. Nothing to front-run, sandwich, or backrun. No MEV, so no builder is needed, so a committee of ordinary validators can include them with no loss of efficiency, because there was no efficiency for a specialist to add. And if that is all we are talking about, then skip all the complexity and just do Zcash.

## The decision
But what if we could do both? Partition the block by contention.

- Do the regular full block through the builder mev-boost pathway, soon to be ePBS. Contentious state (the EVM, DeFi, everything that reads shared state) stays with the builders. This keeps the market structure that PBS/ePBS built and the efficiency it brings.
- Then create an end-of-block section for private transfers which cannot interact with the public lane state, and do MCP there. Non-contentious state goes to a committee, which is exactly where MCP is free instead of expensive.
- The "centralized" block builders focus on the high contention portion for people who are less concerned about getting censored. The maximally "decentralized" validator network minimizes the chance of censorship for money.
- The two lanes never depend on each other's contents for validity. The only places MEV can appear are the crossings (deposit, unshield), and those are routed through the builder's lane on purpose, so contention stays with the contention specialists.

How the private transfers work internally is not settled by this ADR. The Zcash folks are giga cracked and Ethereum has relevant proposals of its own. The main design requirement is really this: can you decouple the private and public state while still being able to transfer between the two. Everything downstream (ADR-0003's anchor rule, ADR-0004's unshield path, ADR-0006's fee source, ADR-0008's nullifier rule) exists to satisfy that one requirement.

## Positions this design takes
These are positions, not settled facts. Each one could be argued the other way, and the design would change if it were.

- Builders are valuable and should keep the contentious lane. Ordering contention is a skill worth paying for, and the roadmap should sharpen it rather than route around it.
- MCP and encrypted mempools over contentious state are a net negative for markets on Ethereum. They push the specialist out of protocol and cap the market potential of what gets built on top.
- The two lanes carry opposite kinds of orderflow. Contended transactions have value before inclusion, so they are public in content and sent privately to builders. Shielded ops have no value to anyone before inclusion, so they are private in content and can be gossiped in the open to a committee. What the open gossip still exposes is network origin, which the lane topic has to handle (OQ-19).
- The design requirement that decides everything is state decoupling with a transfer path between the two states. Any proposal that cannot decouple private from public state, while still letting value cross, fails here no matter how good its cryptography is.

## The bet
My bet: scaling an execution environment scales contention, and with it the extraction market, the builder centralization pressure, and the pipeline complexity. Scaling shielded payments scales proof verification and data availability, both of which aggregate (one proof per block) and prune (Tachyon-style windows). That is why I think private payments are the workload that can grow toward civilization scale without the growth itself creating a new market to extract from. The contentious lane gets better by getting more specialized. The private lane gets better by getting more decentralized. One block can have both. This is stated as a bet, not a theorem.

## What this rules out
- MCP over the payload. Rejected in ADR-0002 for the reason above.
- Encrypted mempools as the answer for contentious state. Same reason: the market reforms outside the protocol.
- Shielded spends inside the payload (ADR-0008): they would drag the non-contentious workload back into the contentious lane.
- Any lane feature that reads EVM state. If it can be contended, it does not belong in the lane.

## What this borrows
Zcash shows the path to scalable private transfers (Tachyon). FOCIL/MCP shows a path to scalable censorship resistance. ePBS keeps the builders. The design is the observation that these three never compete for the same job.
