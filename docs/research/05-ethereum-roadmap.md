# Ethereum roadmap: privacy and block-pipeline items relevant to a shielded lane

Last reviewed: 2026-09-17.

## ethereum.org privacy roadmap

Three pillars: private reads, private writes, private proving. Under private writes the page names EIP-8141, EIP-7805, EIP-8250, EIP-8182 as "in active development and being considered for the Hegotá upgrade." FOCIL's stated role: "If a block builder attempts to censor a transaction that appeared on the inclusion lists, attesting nodes reject the proposed block entirely." On pools: "Privacy pools use cryptographic mixing to sever the link between deposit and withdrawal, but are only available via privacy apps, wallets, and layer 2 networks today." EIP-8182 "consolidates shielded transfers at the protocol level."

## Vitalik, "A maximally simple L1 privacy roadmap" (2025-04-10, magicians 23459)

Nine items. L1 changes named: FOCIL and EIP-7701 (account abstraction, since superseded by the EIP-8141 line). Item 8: proof aggregation protocols so privacy transactions share one on-chain proof. Pools stay at the app layer (Railgun, Privacy Pools) with a wallet-level "shielded balance." Commenters raised DeFi composability across per-app addresses; unresolved.

## PSE roadmap (2025-09-12)

Private writes "rely on Layer 2 aggregation and optimized ZK circuits." No L1 lane. Milestones 2025-2028.

## Pierre, "Towards Native Post-Quantum Private ETH" (ethresear.ch 25291, 2026-06-24)

Argues for hash-based SNARKs (WHIR/STIR) and join-split statements, ML-KEM for secret distribution, hash-based signatures, and against requiring proof generation on hardware wallets. Reply (71104) pushes recursive aggregation with sub-KiB WHIR proofs. rdubois-crypto: "the real problem is the succinctness that will require aggregation/L2 like system."

## EIP-7503 Zero-Knowledge Wormholes (stagnant, 2023)

Burn to `sha256(MAGIC_ADDRESS + secret)[12:]`, re-mint via a new EIP-2718 tx type with a proof; nullifier stored at `WORMHOLE_NULLIFIER_ADDRESS`. "a deposit onchain is not distinguishable from sending ether to a friend." Precedent for a native mint tx type. One hop only.

## EIP-7886 Delayed execution (stagnant)

Static validity without execution; `pre_state_root` in header; execution outputs deferred to the next header; senders pre-charged max fees. Conceptual model for a lane whose validity is proofs plus a window check, not EVM execution.

## EIP-7928 Block-level access lists (Glamsterdam headliner)

Per-block declared reads and writes with post-values; header carries `block_access_list_hash`; "Transaction execution cannot be parallelized without knowing in advance which addresses and storage slots will be accessed." Gives a formal way to show the lane's access set is disjoint from the payload's.

## EIP-7732 ePBS (Glamsterdam headliner)

Proposer commits to a builder bid at t=0; payload revealed later. A lane whose pre-state is end of N-1 can be committed in the same beacon block without the payload.

## EIP-4844 blobs, EIP-7002 withdrawals, CL withdrawals

Blobs: a second lane with its own fee market, verified by the CL, no EVM state. EIP-7002: a system contract queue drained at block boundaries. CL withdrawals: balance credits applied in block processing with no code execution. These are the three structural precedents the lane borrows.

## Scourge and Verge (Vitalik, 2024-10)

Scourge on MCP: "k parallel proposers generate lists of transactions, and then using a deterministic algorithm (eg. order by highest-to-lowest fee) to choose the order." Verge goal: "fully-verifying clients, and staking nodes, should not need more than a few GB of storage"; Verkle rejected for quantum reasons in favor of STARKed binary trees; "Validity proofs of EVM execution" as a component. A closed shielded lane is a natural first subsystem to verify by validity proof.

## Sources

- https://ethereum.org/roadmap/privacy/
- https://ethereum-magicians.org/t/a-maximally-simple-l1-privacy-roadmap/23459
- https://www.theblock.co/post/370532/ethereum-foundation-sets-end-to-end-privacy-roadmap-with-private-writes-reads-and-proving
- https://ethresear.ch/t/towards-native-post-quantum-private-eth/25291
- https://eips.ethereum.org/EIPS/eip-7503
- https://eips.ethereum.org/EIPS/eip-7886
- https://eips.ethereum.org/EIPS/eip-7928
- https://eips.ethereum.org/EIPS/eip-8272
- https://vitalik.eth.limo/general/2024/10/20/futures3.html
- https://vitalik.eth.limo/general/2024/10/23/futures4.html
