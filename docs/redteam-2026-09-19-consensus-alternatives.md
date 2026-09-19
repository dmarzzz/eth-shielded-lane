# Red team: shielded lane, reviewed for consensus, incentives, complexity and alternatives

Research date: 2026-09-19. This was a read-only review and no files were changed.

Option (2), the payload-side pool with FOCIL enforcement, captures most of what the lane offers. The dossier's roadmap status is also stale, and that changes the pitch.

Two things could not be verified:
- Quotes from the EF Hegotá tier-list post came through a fetch summarizer. Confirm the exact wording before quoting them publicly.
- How FOCIL list obligations behave in an ePBS empty slot could not be checked.

## Findings, most severe first

### 1. The roadmap already chose option (4), and the dossier's status table is wrong

**Severity: fatal to the framing, serious to the design.**

- README §6 lists EIP-8182 as "Hegotá, PFI, Review". The thread says it is "proposed and under discussion for the same fork".
- EIP-8081 (the Hegotá meta EIP) now lists 8182 under **Declined for Inclusion**. The change landed 2026-09-14 in the commit "DFI decisions from ACDE245" (https://github.com/ethereum/EIPs/commit/aad37d71f92291e4bec2966057a6b8e0287d9e2b).
- The EF Protocol tier list of 2026-09-07 (https://blog.ethereum.org/2026/09/07/protocol-hegota-eips) gives this reason: "Enshrines a specific privacy mechanism; the Frames-based path delivers the same goal with less protocol surface and keeps schemes competing."
- EIP-8141 has been Scheduled for Inclusion since 2026-08-27, so "FOCIL is the only confirmed Hegotá EIP" is also stale.
- The chosen path is EIP-8141 frames, plus EIP-8250 (a nullifier consumed as a single-use keyed nonce), plus EIP-8272, plus EIP-8369 FOCIL Profile 2. The tier list describes 8272 this way: "Recent roots let private transactions use recent onchain state in a form attesters can verify, allowing them to benefit from FOCIL's inclusion guarantees."
- The lane enshrines strictly more than 8182 did, so the same objection applies to it with more force.

*What would answer it:* rewrite ADR-0001 and README §6 against the Frames path, and name one property that Profile 2 cannot deliver.

### 2. Censorship resistance ends at the vault boundary

**Severity: serious, thesis-level.**

- In-pool transfers are indistinguishable from each other. A builder can only censor the whole pool, and FOCIL already makes that costly.
- The censorship FOCIL was designed against targets crossings, such as sanctioned deposits and withdrawals. By ADR-0000, deposits are payload transactions and the unshield is spent by a payload frame transaction at N+1 (ADR-0004).
- So the censorship resistance of the whole path is the minimum of lane CR and FOCIL CR over payload frame transactions. For anyone who exits to the public economy, that is just FOCIL Profile 2's resistance.
- A censored exit also leaves funds in a public UTXO with a public recipient, which is worse than being censored before unshielding.

*What would answer it:* a threat model listing which censors the lane defeats that FOCIL does not. The credible candidates are block stuffing and builder liveness.

### 3. The post-red-team conflict rule lets one note invalidate every block

**Severity: fatal as written, fixable.**

- Spec §3 now says a lane with any nullifier conflict is INVALID.
- Spec §7 says attesters MUST reject a lane that omits a listed op whose nullifiers were "unspent as of end of N-1".
- A user can send op A to committee member 3 and a conflicting op A' to member 7. Both ops pass §7, including both makes the lane invalid, and omitting either violates §7.
- No valid block then exists for that slot, and the attack costs the user only one note.
- FOCIL's actual rule evaluates a missing transaction as appended after the block as built, which resolves this. The spec moved the evaluation point to N-1 and lost that property.
- A residual problem remains. A' has been gossiped and verified by everyone but pays nothing, so eight notes per slot can fill all 16 lists for the price of eight fees.

*What would answer it:* evaluate omission against the post-lane state, add a canonical tie-break, and charge listed-but-conflicting ops a fee.

### 4. Invalid lane means invalid beacon block, and the proposer pays for it

**Severity: serious.**

- ePBS moved the large payload object off the pre-attestation path. In the consensus-specs mainnet config, `ATTESTATION_DUE_BPS_GLOAS: 2500` is 3 s, `PAYLOAD_DUE_BPS: 5000` is 6 s, and `PAYLOAD_ATTESTATION_DUE_BPS: 7500` is 9 s.
- In Gloas, payload and blob availability failures degrade gracefully. The 512-member PTC votes `payload_present` and `blob_data_available`, and a missed payload makes the slot EMPTY without orphaning the beacon block.
- The lane puts an object of order 1 MB plus pairing checks back before the 3 s attestation deadline (see finding 9), and a failure there orphans the block.
- The proposer loses the slot and cannot repair a bad or conflicting list. The builder loses the slot's MEV opportunity but keeps its payment. A committee member or a user can cause the failure at almost no cost. This extends R3 in the prior red team.

*What would answer it:* lane-empty semantics, given as improvement 4 below.

### 5. "The lane survives builder withholding" is false when lane state lives in the EL

**Severity: serious.**

- ADR-0008 claims the lane still applies if the payload is withheld.
- An ePBS empty slot has no EL state transition. Gloas defers even withdrawals in that case.
- `apply_lane` writes EL state (spec §5), so the claim cannot hold as the spec is written.
- The claim becomes true only if the shielded state lives in the beacon state, which is option (5) in the table below.

*What would answer it:* decide where the state lives (this extends C2 in the prior red team), then re-derive the timing claims from that decision.

### 6. The v0 lane is a union of committee lists, so its throughput is about one list

**Severity: serious.**

- At v0 the lane is "the deterministic union of committee lists" (spec §6).
- If 16 honest members list from the same mempool under the same fee rule, their lists are near-duplicates of each other.
- The hard ceiling is 16 × 8 KiB = 128 KiB, roughly 110 ops at about 1.1 KB each (my estimate). Realistic output is closer to one list.
- The dossier's own research note quotes the relevant result from Price of Censorship: "eCR scales linearly with the number of proposers, while throughput quickly plateaus."
- FOCIL can tolerate duplicated lists because its lists are a backstop. In the lane, the lists are the block itself.

*What would answer it:* a partition rule, for example nullifier prefix mod 16 selects the primary lister, or allow the proposer to fill the lane beyond the lists.

### 7. The lane assigns paid-style work to a committee FOCIL deliberately left unpaid

**Severity: serious.**

- EIP-7805 states: "FOCIL does not provide explicit rewards for IL committee members... We believe that the added complexity of implementing a transaction fee system for FOCIL is not justified. Instead, we rely on altruistic behavior, as FOCIL requires only a `1-out-of-N` honesty assumption."
- The lane asks the same committee to verify SNARKs before listing (spec §7).
- The spec is inconsistent about who is paid. §5 pays tips to `lane.proposer`, while §6 says there is no such role at v0.
- If tips go to the slot proposer, the committee does the verification work unpaid. If tips go to the listers, the design needs per-op attribution and a duplication-penalizing transaction fee mechanism.
- If the proposer is allowed to fill the lane (see finding 6), it becomes a builder of the lane. There is no MEV to extract there, so this is benign. It is still a new market.
- The proposer gains no informational edge from committing the lane at t=0. The lists, including each unshield's `(recipient, value)`, are public gossip from slot N. That gives everyone about two slots of notice before an unshield is spendable, a longer window than R4 stated.
- On OQ-17, I infer that builder bids fall only by the tips on private transfers, which is small. The orphan-risk coupling described in finding 4 is the larger effect on builders.

*What would answer it:* a specification of the fee mechanism, or a decision to drop tips and burn all lane fees.

### 8. The v2 aggregator is a builder

**Severity: serious, thesis-level.**

- ADR-0000 argues that specialized work with economies of scale belongs with builders.
- Recursive aggregation is latency-critical and hardware-heavy, and OQ-3 gives the aggregator about two seconds to do it.
- So the design removes builders from the lane at v0 and then recreates a builder-like role at v2, without ePBS's payment and withholding machinery.
- The consistent split is that builders assemble and aggregate while the committee forces inclusion. That is option (2) with an aggregation step added.

*What would answer it:* an argument for why the builder cannot be the aggregator under FOCIL enforcement.

### 9. Attester load is modest for compute and tight for bandwidth

**Severity: fixable.**

Sourced numbers:
- BN254 pairing timings from https://hackmd.io/@gnark/eccbench (AWS z1d, 3.4 GHz Xeon, 2021-01-29):

  | Library | Miller loop | Final exponentiation | Full pairing |
  |---|---|---|---|
  | gnark-crypto | 0.2321 ms | 0.2569 ms | 0.4890 ms |
  | arkworks+asm | not captured | not captured | 1.0655 ms |
- Groth16 verification costs "3 pairings" plus a size-ℓ G1 MSM, about "1.2 milliseconds". Batch verification of b proofs needs "a size-(b+2) multi-pairing", b G1 scalar multiplications, and two MSMs (https://alinush.github.io/groth16).
- EIP-1108 prices the pairing precompile at `34 000 * k + 45 000` gas.

My estimates:
- Batched verification costs 0.3 to 0.7 ms per proof on one core.
- 1,000 ops therefore cost 0.3 to 0.7 core-seconds, or roughly 80 to 180 ms on 4 cores.
- If attesters can spare 150 to 250 ms, the compute ceiling is about 1,000 to 2,000 ops per lane.
- The tighter limits are elsewhere:
  - Bandwidth: at about 1.1 KB per op, 1,000 ops is about 1.1 MB before the 3 s attestation deadline.
  - State access: the design needs two nullifier lookups per op against a permanent set held by the EL, which means an engine-API round trip before attesting.
- The worst case is adversarial. Omitted-op checks cannot be batched, so 128 ops at 1 to 1.5 ms each costs 0.13 to 0.2 core-seconds.

Comparison with option (4), also my estimate:
- A Groth16 verify in the EVM costs roughly 200k to 250k gas.
- Profile 2's candidate `MAX_VERIFY_GAS_PER_IL = 2**20` allows about 4 proofs per list, so at most about 64 to 80 per slot.
- That is the same order of magnitude as the v0 lane's ceiling of about 110 ops.

Quick Slots (EIP-8198, PFI for Hegotá) would shorten every timing window above.

*What would answer it:* a benchmark of the OQ-15 verification path on home-staker hardware.

### 10. Contention is lower in the lane, but it is not zero

**Severity: fixable.**

- This adds to R4. Lane space has its own EIP-1559 market, so fee ordering still exists at the committee.
- Listing capacity is a contended resource, as findings 3 and 6 show.
- Leaf indices are a shared write, and this is handled only by deterministic ordering.
- The claim "MCP is cheap where contention is low" holds for MEV. It does not hold for MCP's other costs, which are duplication, free data availability, and unpaid work.

*What would answer it:* restate the thesis as "MCP's MEV cost vanishes; its throughput and incentive costs remain."

### 11. Correction to prior red-team item F5

**Severity: cosmetic.**

- F5 said the thread's t=3 attestation time was wrong.
- Under Gloas, 3 s is correct. The "4s" in EIP-7805's text predates ePBS.
- The composition of FOCIL and ePBS timings is still not specified anywhere.

*What would answer it:* cite the consensus-specs config constants (`ATTESTATION_DUE_BPS_GLOAS`, `PAYLOAD_DUE_BPS`) in ADR-0008 and label the FOCIL-on-ePBS composition as assumed.

## F. Complexity inventory

New consensus-critical components the lane adds:
- a beacon block field;
- a lane body or sidecar with its own gossip topic;
- a lane inclusion-list type, topic and byte budget, which is an amendment to EIP-7805;
- a committee duty to verify proofs before listing;
- a change to the attester validity rule;
- a native Groth16/BN254 verifier and ceremony verifying key shipped inside CL clients;
- a nullifier set, two 8192-entry rings, and sealed batches;
- a deposit queue with block-end system operations;
- a lane fee market;
- a tip-UTXO rule;
- a transparent-UTXO chassis, which has no EIP;
- engine API changes;
- at v2, an aggregator role, a recursive verifier, and a note-format migration.

Status of dependencies as of 2026-09-19, taken from EIP-8081, EIP-7773 and each EIP's front matter:

| EIP | Status |
|---|---|
| EIP-7732 (ePBS) | Review, SFI for Glamsterdam. Sepolia activation 2026-10-06; mainnet unset. |
| EIP-7928 (BALs) | Review, SFI for Glamsterdam. |
| EIP-7805 (FOCIL) | Draft, SFI for Hegotá. |
| EIP-8141 (frames) | Draft, SFI for Hegotá. |
| EIP-8250, EIP-8272 | Draft, PFI for Hegotá. |
| EIP-8369 (FOCIL eligibility profiles) | Draft, Informational. |
| **EIP-8182** | **Review, DFI for Hegotá.** |
| Native UTXOs | No EIP. |
| EIP-8079 (native rollups) | Draft, in no fork. |

## A. Comparison table

| Axis | (1) Lane as designed | (2) 8182 in payload + FOCIL | (3) Native rollup | (4) App pool + frames + FOCIL Profile 2 | (5) CL-side lane object |
|---|---|---|---|---|---|
| Censorship resistance of a private transfer | 1-of-16 honest per slot, no builder. Exit crossing falls back to FOCIL. | 1-of-16 honest (Profile 1). A reverted proof still counts as included, so attesters verify nothing. | Depends on sequencing. FOCIL covers only a user-posted L1 batch. | 1-of-16 honest under Profile 2. Weaker if builder-chosen index games apply, though nullifier keys are moved only by the spender. | Same as (1), and it truly survives empty slots. |
| Who can censor, and at what cost | All 16 members colluding, or list-stuffing at roughly 8 fees per slot (finding 3). | A builder stuffing blocks, with the base fee rising 12.5% per block. Relayers can censor, but they are replaceable. | The sequencer, if not based. | Same as (2). Paymasters remove the relayer. | Same as (1). |
| Anonymity-set unification | One set. | One set. | Split off from L1. | Split per app, with "schemes competing". | One set. |
| Latency to and from L1 accounts | 1 block in, about 2 blocks out. | Same block, with an atomic CALL. | 1 block in. Out depends on proving. | Same block. | 1 block in. Out as a withdrawal-style credit. |
| New consensus-critical code | Very high (see F). | One system contract. | EXECUTE precompile plus the rollup itself. | None beyond scheduled EIPs. | High: state and verifier in the CL. |
| New cryptography in consensus | Groth16 plus a ceremony in the CL. v2 adds recursion. | Groth16 in the EL, fork-swappable. | None if re-execution. A zkVM if proofs are used. | None. | Same as (1). |
| Attester burden | Proofs, lookups and about 1 MB before t=3. | Nonce and balance check only. | None. | Capped at `2**20` VERIFY gas per list (candidate value). | Same as (1), though it can be moved to a PTC-style vote. |
| Unshipped dependencies | 7732, 7805, 7928, 8141, the 8182 note model, UTXOs, the 7805 amendment. | 7805 and 8182 (now DFI). | 8079, which states "do not support custom opcodes, custom precompiles or custom transaction types". | 7805, 8141, 8250, 8272, 8369 profiles. | 7732, 7805, and EIP-7685-style requests. |
| Cost to builders | Private-transfer tips plus orphan risk. | Nothing; they gain the tips. | Nothing. | Nothing. | Private-transfer tips only, if lane-empty semantics are used. |
| Upgrade and post-quantum path | Hard fork, all CL clients, and a pool migration. | Hard-fork contract swap. | Rollup upgrade. | Deploy a new pool with no fork. | Same as (1). |

**What the lane buys over option (2).** At v0 the lane adds three things:
- its own resource budget, which makes it immune to block stuffing and to public fee spikes;
- inclusion that does not pass through a builder;
- independence from builder liveness, but only if it is rebuilt as option (5).

Everything else comes from other sources:
- The unified anonymity set comes from enshrinement, which 8182 also had.
- FOCIL enforcement is cheaper in option (2).
- Native-cost verification is a repricing question.
- Aggregation and pruning are orthogonal to where in the block the transfers sit.

Honestly, the lane buys little over option (2). The first of the three benefits is also obtainable with a reserved gas carve-out for listed transactions.

**On the author's closing doubt.** If the two lanes truly do not interact, coupling them in one block buys:
- a shared finality and reorg domain;
- one-block crossings;
- enforcement by the same validator set;
- no bridge.

Coupling costs:
- proof verification on the attestation critical path;
- an implementation burden on every client;
- lane bugs that become consensus bugs.

Option (5) keeps every one of those benefits with lane-empty failure handling. Option (3) is not available for this use, because EIP-8079 excludes custom state transition functions.

## Improvements I would make, ranked by value over complexity

1. **Correct the status tables and the thread.** Record 8182 as DFI and 8141 as SFI, and reposition the proposal as something Frames plus Profile 2 cannot do.
2. **Staged step 0, with no new consensus code.** Deploy the pool as a contract on 8141, 8250, 8272 and Profile 2, with each nullifier as a keyed nonce. This step delivers the dossier's value by itself. It should measure builder censorship of private transactions, block stuffing, and the rate at which Profile 2 capacity is exhausted.
3. **Staged step 1, one small rule.** Reserve a gas carve-out that only inclusion-list transactions can consume. This closes the "block full" excuse without a second lane.
4. **If a lane is still justified, give it lane-empty semantics.**
   - Carry the lane body as a sidecar.
   - Have attesters enforce availability and list-completeness by hash only, with no cryptography.
   - At v0, skip an invalid op, reserve its leaf slots, and penalize whoever listed it.
   - If a whole lane fails, the result is lane-empty and the beacon block stands.
   - Listed ops carry over for K slots. This is possible because they anchor to N-1 or older roots, so they remain valid.
   - The inclusion guarantee weakens from "this slot" to "within K slots unless K consecutive proposers collude".
5. **Put shielded state in the beacon state.** Handle deposits as EIP-7685-style requests and unshields as withdrawal-style credits (ADR-0004 alternative 2). This removes the dependency on a UTXO chassis and on frames, and it makes ADR-0008's withholding claim true.
6. **Fix §7.** Evaluate omissions against the post-lane state, add a canonical tie-break, and charge a fee to losers of a conflict.
7. **Partition the listers by nullifier prefix, and burn lane fees instead of paying tips.**
8. **At v2, let the builder aggregate under FOCIL enforcement** instead of inventing an aggregator role.

## Relevant files

- `README.md` (§5, §6)
- `docs/design/spec-draft.md` (§3, §5, §6, §7)
- `docs/decisions/ADR-0000-partition-by-contention.md`, plus ADR-0001, ADR-0004, ADR-0007 and ADR-0008
- `docs/redteam-2026-09-17.md` (F5 corrected; R3, R4 and C2 extended)
- `the draft X thread (not in this repo)` (the roadmap tweet and the "only EIP confirmed" tweet are stale)
