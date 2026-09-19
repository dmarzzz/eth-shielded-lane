# Red team: separation of the payload and the shielded lane, and the two crossings

**Verdict.** "No overlap between the lanes" is false as written, and true only in a narrower form about validity within a single block. Read-only review; no files were changed. Findings extend or correct `docs/redteam-2026-09-17.md` rather than repeat it.

## Shared-state ledger (part A)

| State | Payload in N | Lane and block end in N | Lane validity depends on payload? | State depends on order? |
|---|---|---|---|---|
| `vault_balance` | deposits add, frame claims subtract | base-fee burn subtracts | No | No. All additive, given a solvency invariant the spec never states. |
| `deposit_queue` | append | drain | No | Only through the fixed rule |
| `next_leaf_index`, tree, `commitment_root_ring[N]` | none directly | lane outputs, then the drain | Yes for fresh anchors (finding 2) | Yes |
| `next_utxo_index`, `openings_root_ring[N]` | frame txs can mint UTXOs | unshield and tip openings | No. The Unshield proof commits to `(recipient, value)` only. | Yes (finding 4) |
| spent bitfield | claims write | none | No | No |
| lane base fee | none | lane only | No | No |
| nullifier state | none (ADR-0008) | lane only | No | No |

## Findings

**1. "The lane applies even if the payload is missing" has no defined state transition. Severity: serious.**
- ADR-0008 says a withheld payload leaves the lane applying. Spec §5 runs `apply_lane` "after payload" and drains a queue the payload wrote.
- If shielded state sits in the execution-layer (EL) trie, an empty slot changes EL state with no EL block, no header and no state root. The next payload's `parent_hash` then names a block whose post-state is not its pre-state. The consensus layer (CL) is the only other place it can sit.
- Gloas already handles the empty case for CL-side state:
  - `process_parent_execution_payload` applies the parent's requests in the next beacon block, with the branch "Parent was EMPTY -- no execution requests expected".
  - `process_withdrawals` has "Return early if the parent block is empty".
  - Source: https://github.com/ethereum/consensus-specs/blob/master/specs/gloas/beacon-chain.md
- The prior red team's C2 said the CL/EL split is undrawn. The sharper point is that ADR-0008's survival property forces the state into the CL.
- The PTC attests timeliness, not validity (EIP-7732: "PTC members are not required to validate the execution payload"). A timely but invalid payload therefore resolves like an empty one, one slot later.
- What would answer it:
  - An ADR placing shielded state in the beacon state.
  - Deposits become a new EIP-7685 request type, applied through `parent_execution_requests`.
  - The lane is applied in `process_block`.

**2. The builder co-writes every root the lane can anchor to. Severity: serious.**
- The block-end drain puts payload N's deposits into `commitment_root_ring[N]`. No lane-only root is sealed.
- A note created in lane N can only be spent against a root that needs payload N. Payload N is due at t=6 (`PAYLOAD_DUE_BPS: 5000`).
- That root has two candidate values, full or empty, until beacon block N+1 picks a parent.
- The committee for lane N+1 must list by t=8 (`INCLUSION_LIST_DUE_BPS: 6667`). The PTC votes at t=9 (`PAYLOAD_ATTESTATION_DUE_BPS: 7500`).
- Spec §7 makes an invalid listed op "attributable to its lister". An honest lister of a fresh-anchored op is therefore blamed whenever the payload resolves as empty.
- The accurate claim: lane validity is independent of the payload in the same block, and depends on the previous payload's status for fresh anchors.
- What would answer it, either of:
  - A separate deposit tree with its own ring, with a private per-input selector in the circuit.
  - An anchor lag of at least two blocks.
- With a separate tree, lane state no longer changes with full or empty payloads.

**3. ADR-0003's stated reason for the queue is wrong at v0, and the queue only moves the dependency. Severity: serious.**
- ADR-0003 says "lane proofs depend on the builder's deposit count".
- EIP-8182 assigns the index in the contract: "The final inserted `noteCommitment` includes a contract-assigned leaf index and is therefore not itself the authorization-lock target" (https://eips.ethereum.org/EIPS/eip-8182).
- Proofs bind `noteBodyCommitment`. No prover can know its position in a lane ordered by "(member index, list position)" (spec §6).
- Spec §3's `out_commitments` must therefore be body commitments. If they were final commitments the design could not be built.
- Inference: the queue matters only once something commits to the post-lane root, which is v2.
- Even then, lane N's indices depend on payload N-1's deposit count. That count is revealed at t=6 of slot N-1, with full or empty status still unresolved.
- What would answer it:
  - Rename the field to make clear it is a body commitment.
  - Rewrite the ADR's context section.
  - Adopt the separate deposit tree from finding 2.

**4. The claim step shares an index with the payload and may not be FOCIL-eligible. Severity: serious.**
- The payload applies first, and Nero-style frame settlement can mint UTXOs. Lane opening indices in N therefore equal `next_utxo_index` plus the payload's mint count.
- An empty payload shifts those indices, so a claim signed against one index dies on the other branch.
- The censorship part compares two rules:
  - EIP-7805 validates an omitted list transaction "by checking the nonce and balance of `T.origin`".
  - EIP-8141 says a validation prefix that depends on third-party mutable state "must result in rejection by the public mempool".
- EIP-8272 opens a hole for recent roots only: "No other opcode, call, storage read, or storage write exception is added."
- Inference: a claim's VERIFY frame must read the vault's spent bit. It is then either ineligible for the public mempool, and so invisible to list builders, or it uses the vault as sender and hits "at most one pending frame transaction per sender".
- **Not verified:** how Nero's post resolves this.
- What would answer it, either of:
  - Give lane openings their own namespace `(block, position)` with their own bitfield, plus an explicit EIP-7805/8141 carve-out for claims.
  - Remove the claim step entirely (improvement 1).

**5. The drain is unbounded and unpriced, and its precedent does not transfer. Severity: fixable.**
- Spec §5 drains the entire queue, and nothing prices the insert at block end.
- EIP-6110 leaves its deposit list unbounded only because "With 1 ETH as a minimum deposit amount, the lowest cost of a byte of deposit data is 1 ETH/192 ~ 5,208,333 Gwei" (https://eips.ethereum.org/EIPS/eip-6110). The shielded vault has no minimum deposit.
- The rate-limited queues look like this:
  - EIP-7002 sets `MAX_WITHDRAWAL_REQUESTS_PER_BLOCK` = 16 and `TARGET_WITHDRAWAL_REQUESTS_PER_BLOCK` = 2, with a fee that "scales the fee up exponentially" (https://eips.ethereum.org/EIPS/eip-7002).
  - EIP-7251 sets `MAX_CONSOLIDATION_REQUESTS_PER_BLOCK` = 2 and `TARGET_CONSOLIDATION_REQUESTS_PER_BLOCK` = 1 (https://eips.ethereum.org/EIPS/eip-7251).
  - Consensus-specs presets list `MAX_DEPOSIT_REQUESTS_PER_PAYLOAD: 8192`.
- My arithmetic, not measured:
  - About 30k gas per batched deposit gives about 2,000 deposits per 60M-gas block.
  - Appending about 2,000 leaves natively is a few thousand Poseidon hashes, which is negligible.
  - The real costs are permanent leaves and data. Sustained full blocks would fill 2^32 leaves in about 300 days.
- What would answer it:
  - A `MIN_DEPOSIT`.
  - A 7002-style excess fee.
  - A per-block drain cap, with the remainder carried over.
  - A measurement of deposit gas.

**6. The latency table conflates rule and practice (part C). Severity: fixable.**
- I checked the timings against the consensus-specs mainnet config, with `SLOT_DURATION_MS: 12000`:
  - attestation due at 3 s
  - payload due at 6 s
  - PTC vote at 9 s
  - inclusion lists due at 8 s
- EIP-7732 agrees: "giving the next proposer 6 seconds ... and every other validator 9 seconds" (https://eips.ethereum.org/EIPS/eip-7732).
- Correction to the prior red team's F5: EIP-7805's "`Slot N+1`, `t=4s`" is the pre-Gloas deadline, so the repo's t=3 is right for a composition with ePBS.
- EIP-7805 also says its builder freeze at t=11 is provisional: "exact timings will be defined after running some tests/benchmarks" (https://eips.ethereum.org/EIPS/eip-7805).

| Path | Validity rule | Practical |
|---|---|---|
| (i) deposit in N, first spend | lane N+1 (§3, §9) | lane N+2 |
| (ii) note in lane N, next spend | N+1 | N+2 today. N+1 with a lane-only root, because lane N is known at t=0. |
| (iii) unshield in N, claim | payload N+1 | N+1 if the builder cooperates. N+2 if inclusion is forced through FOCIL. |

- On (i): payload N lands at t=6 and lists close at t=8. Those two seconds must cover propagation, execution, path fetch and Groth16 proving, which is seconds (unmeasured).
- On (iii): a list member can only validate the claim after t=6, and EIP-8272 rejects `slot >= current_slot`.
- So §9 states the validity rule, and ADR-0008's "N+2" states the practical consequence.
- What would answer it:
  - Publish both columns.
  - Measure wallet proving time.

**7. End-to-end censorship resistance is plain FOCIL at both crossings. Severity: serious for the framing.**
- A deposit is visibly a call to the vault. Builders who filter will drop it, and only ordinary FOCIL forces it in.
- A full block excuses the builder from including it: "Check whether `B` has enough remaining gas to execute `T`. If `T.gas` > `gas_left`, then jump to the next transaction".
- The claim has no ordering value, because only its recipient can spend it. Censoring it delays the recipient and loses them nothing. That holds until the 8192-block openings ring rolls over (OQ-9).
- The lane's real additions over EIP-8182 plus FOCIL are three:
  - no block-full escape
  - a dedicated byte budget
  - survival when a payload is withheld
- "Minimizes the chance of censorship for money" therefore holds only inside the pool.
- Inference: an unshield to a sanctioned recipient is public, and the lane forces the proposer to commit it. Plain FOCIL puts that burden on builders instead.
- What would answer it:
  - State the claim as covering transfers inside the pool only.
  - Ask for a legal review of the proposer-side burden.

**8. Crossing privacy leaks that the ADRs do not name (part E). Severity: fixable.**
- `anchor_root` is public.
  - A just-deposited note must anchor at or after its deposit block, which links deposit to first spend.
  - Anchor choice generally fingerprints how recently a wallet synced.
- `fee` is a public input and carries a free tip, which contradicts ADR-0006's "uniform per-shape pricing".
- Wallets that auto-claim at N+1 stand out from those that delay.
- Lane gossip is low-volume and has no sender field. First-seen network origin, plus the RPC that serves Merkle paths, is then the only identity signal. Any node sees it, not only the committee of 16.
- The anonymity set is split from an in-payload EIP-8182 pool and from app-layer pools, and it splits again at the v0 to v2 migration.
- What would answer it:
  - One mandated anchor per lane.
  - The fee set exactly equal to the lane base fee.
  - Dandelion-style relay for the lane topic.

**9. Wording nits. Severity: cosmetic.**
- ADR-0008 says payload N+1 depends on "nothing" from the lane. Claims read the openings that lane N wrote.
- Spec §5 tips `lane.proposer`, but §6 says v0 has none.
- §4 checks `fee <= max_fee` and never checks a floor against the base fee.

## Improvements I would make

Ranked by value over complexity.

1. **Settle unshields as EIP-4895-style system credits in the next full payload** (ADR-0004 alternative 3).
   - EIP-4895: "This balance change is unconditional and **MUST** not fail" and "This operation has no associated gas costs" (https://eips.ethereum.org/EIPS/eip-4895).
   - This removes the user transaction, the censorable step, the claim cadence, contract-recipient burns, and the EIP-8141 and Nero dependencies.
   - Lane validity is untouched. Payload N+1 must match a list that is known a full slot ahead.
   - Costs:
     - The per-payload cap is 16 today (`MAX_WITHDRAWALS_PER_PAYLOAD`), so the lane must rate-limit unshields or the cap must rise.
     - Credits back up behind empty slots. EIP-7732 notes: "the consensus layer does not process any more withdrawals until an execution payload has fulfilled the outstanding ones".
     - New-account state must be priced into the Unshield shape.
2. **Keep deposits in a separate tree**, or seal a lane-only root. This gives a true one-block respend, makes lane state independent of whether a payload was full or empty, and removes the insert-ordering rule.
3. **Put shielded state in the CL**, with deposits as EIP-7685 requests.
4. **Mandate one anchor per lane, at least two blocks back.**
5. **Bound and price deposits**: a minimum, an excess fee, and a drain cap.
6. **If UTXOs stay, give lane openings their own index namespace** so claims can be pre-signed at t=0.
7. **Set the fee exactly equal to a per-epoch lane base fee, with no tips**, and pay the proposer on the CL.
8. **Add private relay for lane gossip, and default wallet denominations at the crossings.**

## Public wording of the separation property (39 words)

"A lane's validity never depends on the payload in its own block: it reads only shielded state sealed in earlier blocks and only appends. Value crosses via two queued one-way crossings, deposit and unshield, each settling a block later."

The stronger form, "neither lane reads what the other writes", becomes literally true only after improvements 2 and 6.

## What I could and could not verify

**Verified verbatim:**
- The EIP quotes from raw EIP texts in ethereum/EIPs master: EIP-7732, 7805, 6110, 7002, 7251, 4895, 8141, 8272 and 8182.
- The Gloas function and branch quotes (`process_parent_execution_payload`, `process_withdrawals`) from `specs/gloas/beacon-chain.md` in consensus-specs master, as cited in finding 1.
- The config constants from consensus-specs `configs/mainnet.yaml`.
- The preset constants from `presets/mainnet/electra.yaml` and `presets/mainnet/capella.yaml`.

**Not verified:**
- Nero's frame-claim mempool handling.
- Any proving-time or gas figure.
- Legal exposure.

Inferences are labelled inline.

**Files reviewed:**
- `README.md`
- `docs/design/spec-draft.md`
- `docs/decisions/ADR-0000` through `ADR-0008`
- `docs/redteam-2026-09-17.md`
- `docs/research/02-native-utxos.md`
- `docs/research/03-focil.md`
- `docs/research/04-eip-8182.md`
- `the draft X thread (not in this repo)`
