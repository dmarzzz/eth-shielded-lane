# Changelog

## 2026-09-19
- Second red team, two reports: `docs/redteam-2026-09-19-crossings.md` (the separation property and both crossings) and `docs/redteam-2026-09-19-consensus-alternatives.md` (fork choice, incentives, attester load, alternatives table, staged path).
- ADR-0009: one writer per structure. Deposits get their own payload-written tree, read by lanes two blocks late; the deposit queue and block-end drain are removed. Unshields become system credits paid from a lane-written outbox at the start of the next full payload (EIP-4895 pattern, vault as turnstile); the transparent-UTXO unshield and its claim transaction are removed. Supersedes parts of ADR-0003 and ADR-0004.
- ADR-0010: validity is per op and a lane cannot be invalid. Fixes the attack where one user sends conflicting ops to two listers and no valid block exists. Inclusion is checked by hash; listers are partitioned with redundancy `r` (OQ-18 opened).
- ADR-0011: the lane root is verified one slot late and shielded state is its own domain committed in the beacon state. Makes ADR-0008's withholding claim true.
- Spec draft v0.2 rewritten around the three ADRs. Crossings table now gives earliest blocks: deposit N+2, respend N+1, unshield credit N+1.
- Roadmap table corrected against EIP-8081: FOCIL and EIP-8141 are SFI for Hegotá, EIP-8250 and EIP-8272 are PFI, EIP-8182 was declined on 2026-09-14.
- Consistency pass after v0.2: status notes on ADR-0001, 0005, 0006, 0007; README ADR table marks 0004 superseded; OQ-9 and OQ-14 rewritten, OQ-19 (network privacy of lane gossip) opened; spec gains a gossip-privacy line, the engine API additions and a constants table; ADR-0000 gains the orderflow position (public txs sent privately, private ops gossiped publicly).
- ADR-0012: one design, delivered as a sequence of EIPs. Resolves OQ-14.
- Last adversarial pass on the separation: deposit leaves are computed by the vault from the ETH received (no opaque leaves), nullifier derivation carries a tree tag, deposit roots cross as EIP-7685-style requests mirrored in the beacon state, unshields queue with an excess fee instead of being dropped at a cap, reorg-induced no-ops are not lister faults.
- `media/` added: seven figures, the explainer film and the two crossing animations, with their Remotion sources. README gains a pictures section and direct links to the five sources the design combines.
- First red team de-personalized: section headings name bodies of work, not people, and the method note says plainly that the objections are simulated.
- Thread audit against spec v0.2: the timing figure now shows a lane merge (no aggregator at v0), a hash check before attesting, and the payload depending only on the outbox of earlier lanes.
- Prior art noted: the single-writer notes model is an instance of the "new forms of state" direction (ethresear.ch 24052, 2026-02), which Native UTXOs (25368) already builds on.

## 2026-09-18
- Thesis rewritten from the owner's own narrative: builders keep the contentious lane (propAMM prioritization, JIT routing), MCP and encrypted mempools are a net negative over contended state, MCP is free in the uncontended lane, and state decoupling with a transfer path between the two is the design requirement that decides everything. ADR-0000 gains a "Positions this design takes" list; OQ-17 opened on builder economics of an end-of-block lane.
- Explainer film (Remotion + three.js) built for the thread: v1 build/gossip/commit/reveal/execute; v2 one-block cue and orderly-execution counters; v3 (27.7 s) single glass hull with internal partition, proposer + 512-attester field with quorum counter, PTC vote, six-row swimlane timeline, AgX color pipeline, HDRI-style lighting, DOF/bloom/grain, easing pass, end card. 4K ProRes master rendered. v4 seal-caption sequencing fix; v5 committee re-staged as list-keepers (per-node list stacks, list replication instead of tx bouncing, sealed-slab tags, combined lane list at t=8) after the owner read the ring as a mixer.
- Launch-video quality research: 23 reference films measured, craft/pipeline gap analysis, public-company compliance checklist. Synthesis in docs/launch-video-quality.md.

## 2026-09-17
- ADR-0000 (partition by contention) written as the founding decision; README thesis rewritten around it.
- Red team (docs/redteam-2026-09-17.md). Fixes: v0 nullifier state is a set, not a bitfield; conflicting lanes are invalid rather than repaired; tips paid as transparent UTXOs; v0 lane is the union of committee lists with no aggregator; OQ-15 (attester verification budget) and OQ-16 (lane-specific IL) opened; ADR-0005 v2 wording corrected.
- ADR-0008: nullifier reveals only in the lane; parallel-build timing argument written down; OQ-7 answered. Spec crossings table updated.
- Dossier created from two research passes.
- Pass 1: Tachyon, Native UTXOs (Nero), FOCIL, EIP-8182, PQ private ETH surveyed; composition verdict written.
- Pass 2: Ethereum privacy and block-pipeline roadmap surveyed; MCP literature reviewed and rejected as the model for the side block; two-lane block and transparent-UTXO unshield path drafted.
- ADR-0001 through ADR-0007 recorded. OQ-1 through OQ-14 opened.
