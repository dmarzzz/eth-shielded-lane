# Multiple concurrent proposers: why it is not the model for the lane

Last reviewed: 2026-09-17.

## Designs reviewed

- **Multiplicity** (eljhfx and Max Resnick, ethresear.ch 14962, 2023-03-03): validators sign "special bundles"; "a proposed block is only valid if the leader includes a sufficient quorum... of validator-signed special bundles." Placement and conflict handling unspecified.
- **Concurrent Block Proposers in Ethereum** (Neuder and Resnick, ethresear.ch 18777, 2024-02-23): two proposers; "the spec & clients deterministically de-duplicate the second payload and divide the transaction priority fees between both proposers." fradamt's unanswered question: "who pays if the transactions of the second payload are invalidated by the first one?" hsyodyssey: "whose transaction batch will be executed first?" Unanswered.
- **BRAID** (Resnick, Devcon 7, 2024-11): "a consensus specification for implementing concurrent leaders in ethereum from parallel chains." No public spec text beyond the talk.
- **MCP: Why and How** (Garimidi et al., a16z, arXiv 2509.23984, 2025-09): relays store HECC shreds; leader includes attestations; after reconstruction "Nodes then take the union of transactions included in the batches and orders them by a deterministic rule (e.g., by priority fee) to determine the order they are added to those nodes' logs." Properties: selective-censorship resistance and hiding.
- **Price of Censorship** (Saraf et al., arXiv 2607.16995, 2026-08): "final block is the union of their sub-blocks"; duplication-penalizing fee mechanism performs best; "eCR scales linearly with the number of proposers, while throughput quickly plateaus."
- **MEV in MCP Blockchains** (arXiv 2511.13080): transactions "executed sequentially over the union"; duplicates discarded.

## The common shape

Every design merges the proposers' bundles into one ordered sequence and executes it once. Cross-bundle dependencies are resolved by ordering, and invalidated transactions are a known open problem (the "free DA" issue). That is the opposite of a lane that must not depend on the payload.

## What we take instead

FOCIL already is the committee mechanism Ethereum chose, and its own thread describes it as MCP with single-transaction mini-blocks. The lane composes with FOCIL at the beacon-block level, not at the execution-ordering level. The one MCP result that transfers is the fee-mechanism finding: duplication-penalizing payouts (full tip only if included exactly once) are the right default for lane tips (OQ-3).

## Sources

- https://ethresear.ch/t/multiplicity-a-gadget-for-multiple-concurrent-block-proposers/14962
- https://ethresear.ch/t/concurrent-block-proposers-in-ethereum/18777
- https://archive.devcon.org/devcon-7/braid-implementing-multiple-concurrent-proposers/
- https://arxiv.org/abs/2509.23984
- https://arxiv.org/html/2607.16995
- https://arxiv.org/pdf/2511.13080
- https://ethresear.ch/t/fork-choice-enforced-inclusion-lists-focil-a-simple-committee-based-inclusion-list-proposal/19870/6
