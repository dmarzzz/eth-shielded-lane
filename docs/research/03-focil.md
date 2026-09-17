# FOCIL (EIP-7805): primary-source notes

Last reviewed: 2026-09-17.

## Mechanism

Original post (Thiery, Monnot, D'Amato, Ma; ethresear.ch 2024-06-19):

- "Each slot, a set of validators is selected to become IL committee members." Each broadcasts a local IL from their mempool view.
- Conditional: "The block will still be valid even if some transactions in the IL_agg are not included, as long as the block is completely full."
- Motivation quote: "Two of the top three builders are actively filtering out transactions interacting with sanctioned addresses."

EIP-7805 text (Draft):

- `IL_COMMITTEE_SIZE = 16`, `MAX_BYTES_PER_INCLUSION_LIST = 8 KiB`. Full transactions gossiped on a new global topic.
- Timeline: committee builds and broadcasts at slot N t=0..8s; view freeze t=9s; builder freezes IL view t=11s; attestation deadline slot N+1 t=4s.
- Validity: "Attesters check if the execution payload satisfies IL conditions. This is done either by confirming that all transactions are present or by determining if any missing transactions are invalid."
- Placement: "FOCIL is unopinionated about the placement of transactions from ILs within a block."

CL/EL workflow post (ethresear.ch 20526):

- "The Valid function verifies if the execution payload satisfies IL validity conditions either when all transactions are present or when any missing transactions are found to be invalid when appended to the end of the payload."

Thread reply #6 (The-CTra1n): FOCIL "is a generalization/extension of the concurrent block proposer idea," where "Each IL 'proposer', the validators, is proposing m mini-blocks=single transactions."

## Status

- EF Checkpoint #9 (2026-04-10): "FOCIL (EIP-7805) selected as the consensus layer headliner" for Hegotá. Frame transactions moved to CFI.
- Pulled from Glamsterdam to contain scope alongside ePBS.
- CoinDesk 2026-08-17: FOCIL is the only EIP approved for Hegotá so far; 66 proposals under consideration; 2027 ship target.
- The magicians candidate thread (2025-05-26) reports six client teams with local devnet interop and states compatibility with EIP-7702, delayed execution (7886), BALs (7928), and ePBS (7732).

## What we take from it

- The committee and the enforcement rule (ADR-0007).
- "Valid if appended to the end of the payload" is exactly the evaluation point for an appended lane, and is trivially true when the lane commutes.
- The "block full" escape hatch is the reason the lane needs its own gas budget (ADR-0006).

## Sources

- https://ethresear.ch/t/fork-choice-enforced-inclusion-lists-focil-a-simple-committee-based-inclusion-list-proposal/19870
- https://ethresear.ch/t/focil-cl-el-workflow/20526
- https://eips.ethereum.org/EIPS/eip-7805
- https://ethereum-magicians.org/t/eip-7805-fork-choice-inclusion-lists-focil-as-a-candidate-for-glamsterdam/24342
- https://blog.ethereum.org/2026/04/10/checkpoint-9
- https://www.coindesk.com/tech/2026/08/17/ethereum-s-next-big-upgrade-has-66-proposals-including-a-major-privacy-fix
