# Shielded Lane

**A committee-built private-transfer lane for Ethereum L1: Zcash-style shielded transfers, included FOCIL-style at the end of the block, with Tachyon-style prunable state and one aggregated proof per block.**

This repository is a live research dossier for an active protocol design. The README is the status board. Everything else in the repo is evidence, decisions, or draft spec. If you only read one file, read this one.

| | |
|---|---|
| **Status** | Research, pre-spec. No code. No EIP number. |
| **Origin** | 2026-09-17 hot take: "add zcash style private transfers which are included end of block FOCIL style with some fancy UTXO state and proof aggregation thing that doesn't require all nodes to sync the state." |
| **Maintainer** | [@dmarzzz](https://github.com/dmarzzz) |
| **Last dossier update** | 2026-09-17 |
| **Target** | Post-Hegotá (2027+). Depends on EIP-7805 (FOCIL) shipping in Hegotá. |
| **License** | CC BY 4.0 |

---

## 1. Thesis

Ethereum is about to ship the two pieces a native shielded pool needs for censorship resistance and gas abstraction (FOCIL in Hegotá, frame transactions under consideration), and it already has a shielded-pool EIP on the table (EIP-8182). What EIP-8182 does not solve, by its author's own account, is unprunable nullifier state and per-transaction proof verification. Zcash's Tachyon project solves exactly those two problems for Zcash: validators keep only a recent nullifier window, users carry a recursive proof that their older nullifiers were never revealed, and block producers aggregate shielded transactions into one proof.

The claim of this dossier: those pieces compose into a **second lane in the Ethereum block**. The builder builds the payload as today. A FOCIL-style committee builds a smaller shielded lane that is appended after the payload. The two do not read each other's state. The lane's consensus state is a ring of recent roots plus a nullifier window, so nodes never sync the shielded set. The crossing back to public state goes through a transparent UTXO, so the lane never writes account state at all.

## 2. The design in one screen

```
slot N
┌──────────────────────────────────────────────────────────────────────┐
│ beacon block (proposer, t=0)                                         │
│   ├─ builder payload hash            (ePBS bid, revealed later)      │
│   └─ shielded lane commitment        (committee-built, t=0..8s)      │
├──────────────────────────────────────────────────────────────────────┤
│ execution                                                            │
│   1. builder payload   : normal EVM txs                              │
│        - deposits into the vault (public -> shielded), queued        │
│        - frame txs spending transparent UTXOs (unshield settles)     │
│        - optional inline shielded transact (8182-style, own proof)   │
│   2. shielded lane     : appended, commutes with (1)                 │
│        - N shielded transfers, anchored to roots as of block N-1     │
│        - fees paid from shielded value, no account reads             │
│        - one aggregate proof (v2) or batch-verified proofs (v0)      │
│        - outputs: new commitments, nullifiers, transparent UTXOs     │
│   3. block-end system ops                                            │
│        - drain deposit queue into commitment tree                    │
│        - seal roots for block N into the ring                        │
└──────────────────────────────────────────────────────────────────────┘

consensus state for the shielded system:
   root ring        : last 8192 commitment roots (+ sealed batches)
   nullifier window : nullifiers revealed in the last W blocks
   deposit queue    : pending public -> shielded inserts
   vault balance    : locked ETH / ERC-20
nothing else. no note set, no full nullifier set.
```

Why the lane commutes with the payload:

- Lane transactions read only the root ring and the nullifier window. They write only appends.
- Fees are paid from shielded value (EIP-8182 fee note / Nero vault pattern). The lane never reads an EOA balance or nonce.
- Anchor rule: lane transactions prove against roots as of the end of block N-1. The lane's pre-state is fully known at slot start, so the committee can build and prove it in parallel with the builder, and the proposer commits to both at t=0.
- Conflicts exist only among lane transactions (same nullifier). First wins. The client checks the window itself, so dropping a conflicting entry needs no re-proof.

The only coupling is the two crossings:

| Crossing | Where it runs | How independence is kept |
|---|---|---|
| Deposit (public -> shielded) | payload tx pays into vault with a commitment | queued, drained at block end after lane outputs, so lane leaf indices never depend on the builder |
| Unshield (shielded -> public) | lane emits a **transparent UTXO** (recipient, value) | lane touches zero account state; user spends the UTXO one block later in the payload via a frame tx with self-funded gas |

Proof tiers (ship v0, grow into v2):

| Tier | Proofs verified per block | What it needs | State model |
|---|---|---|---|
| v0 | one Groth16 BN254 per tx, batch-verified natively in the lane | nothing new on the proof side | root ring + permanent nullifier bits (Nero spent-bit style, ~0.3 B/tx) |
| v1 | one per committee member (16) | simple non-recursive aggregation | same |
| v2 | one aggregate for the whole lane | recursion on a curve with an EVM/CL verifier path | root ring + nullifier **window**; users carry PCD non-membership proofs (Tachyon) |

Full draft: [`docs/design/spec-draft.md`](docs/design/spec-draft.md).

## 3. Status board

| Workstream | Status | Notes |
|---|---|---|
| Problem statement and thesis | done | Section 1 |
| Primary-source survey (Tachyon, Nero UTXOs, FOCIL, EIP-8182, roadmap, MCP) | done | [`docs/research/`](docs/research/) |
| Two-lane block structure | drafted | [ADR-0002](docs/decisions/ADR-0002-two-lane-block.md) |
| Unshield path | decided (transparent UTXO), alternatives recorded | [ADR-0004](docs/decisions/ADR-0004-unshield-via-transparent-utxo.md) |
| Slot timing / parallel build argument | decided | [ADR-0008](docs/decisions/ADR-0008-nullifiers-only-in-the-lane.md) |
| Proof system choice | v0 decided (Groth16 BN254), v2 open | [ADR-0005](docs/decisions/ADR-0005-proof-tiers.md), OQ-1 |
| Lane fee market | sketched | OQ-4 |
| Aggregator role and incentives | sketched | OQ-3 |
| Draft spec v0.1 | in progress | [`docs/design/spec-draft.md`](docs/design/spec-draft.md) |
| Nullifier window sizing | not started | OQ-2 |
| Cost model (state, bandwidth, verify time) | not started | OQ-6 |
| Prototype (lane validity checker over a fork of an EL client) | not started | |
| ethresear.ch post | not started | framing in Section 8 |
| EIP draft | not started | blocked on OQ-1, OQ-3 |

## 4. Design decisions

Each decision has an ADR under [`docs/decisions/`](docs/decisions/) with context, alternatives, and consequences.

| ADR | Decision | One-line why |
|---|---|---|
| [0001](docs/decisions/ADR-0001-base-on-eip-8182.md) | Base pool semantics on EIP-8182 | Only shielded-pool proposal with a fork slot; its author concedes the state-growth gap this design fills |
| [0002](docs/decisions/ADR-0002-two-lane-block.md) | Two-lane block, not MCP-style merged execution | Every published MCP design merges bundles into one sequential execution, reintroducing state coupling |
| [0003](docs/decisions/ADR-0003-anchor-at-n-minus-1.md) | Lane anchors to roots as of block N-1 | Makes the lane's pre-state known at slot start; enables parallel building under ePBS |
| [0004](docs/decisions/ADR-0004-unshield-via-transparent-utxo.md) | Unshield into a transparent UTXO, not an account credit | Lane writes zero account state; the account write is a normal payload tx one block later |
| [0005](docs/decisions/ADR-0005-proof-tiers.md) | Ship v0 (per-tx Groth16, batch-verified), design for v2 (single aggregate + windowed nullifiers) | Buildable now on existing precompile assumptions; does not wait on Ragu or a new curve |
| [0006](docs/decisions/ADR-0006-fees-from-shielded-value.md) | Fees paid from shielded value, separate lane gas | Removes every account read from the lane; closes the FOCIL "block full" loophole |
| [0007](docs/decisions/ADR-0007-focil-enforcement.md) | FOCIL committee lists lane txs; attesters reject a lane missing any listed tx | Reuses the Hegotá mechanism; "valid if appended" is trivial because the lane commutes |
| [0008](docs/decisions/ADR-0008-nullifiers-only-in-the-lane.md) | Nullifier reveals only in the lane; no inline shielded spends in the payload | Makes the lane's pre-state known at t=0 of the previous slot, so committee and builder work in parallel and attesters check the lane by t=3 |

## 5. Open questions

Status values: `open`, `researching`, `answered`, `deferred`. An answered question moves its resolution into an ADR.

| ID | Question | Status | What resolves it |
|---|---|---|---|
| OQ-1 | Which recursive proof system for v2? Tachyon's Ragu is Halo/IPA over Pasta; the EVM only has BN254 pairing precompiles. Candidates: PCD on the bn254/grumpkin cycle with a Groth16 wrap; hash-based recursion (WHIR/STIR) with native client verification; a new precompile. | open | Benchmarks of one aggregate over ~1k txs inside a builder window; Ragu benchmarks when published |
| OQ-2 | Nullifier window size W. Too small and honest users with stale PCD get rejected; too large and the pruning win shrinks. Nero uses an 8192-block ring for roots. | open | Model of PCD refresh latency vs. W; oblivious-sync service assumptions |
| OQ-3 | Who aggregates and how are they paid? Slot proposer vs. designated committee member vs. anyone. Equivocation and withholding cases. | researching | Incentive analysis borrowing from FOCIL fee options and the duplication-penalizing TFM in the MCP literature |
| OQ-4 | Lane fee market. Own base fee like blob gas? Fixed price per tx shape? How does base-fee burn from shielded value work? | open | Spec section + simple simulation |
| OQ-5 | Deposit queue vs. ordered insert. Draining deposits at block end is simplest; is a one-block delay on deposits acceptable? | open | UX review; compare with Nero's 1-block latency |
| OQ-6 | Cost model: consensus state, per-block bandwidth for the lane, attester verify time at v0 (batch Groth16) and v2. | open | Spreadsheet with sourced constants |
| OQ-7 | Inline mode. Should 8182-style transact remain allowed in the payload for atomic unshield-act-reshield, given it reveals nullifiers outside the lane? | answered | No. [ADR-0008](docs/decisions/ADR-0008-nullifiers-only-in-the-lane.md): nullifiers only in the lane, which is what makes parallel building and t=0..3 attestation work |
| OQ-8 | PCD custody. Both Nero and Tachyon move data custody to the user. Tachyon answers with oblivious sync services. Who runs those on Ethereum and why? | open | Service model + incentives; wallet-side design |
| OQ-9 | History expiry (EIP-4444). Old openings and roots must stay provable after block bodies are pruned. Nero's answer is "openings are kept around." Need the sealing invariant CPerezz asked for. | open | Specify batch sealing schedule and retention |
| OQ-10 | Post-quantum path. EIP-8182 plans a verifier swap. Pierre's post argues hash-based from day one. Does v2's choice foreclose either? | deferred | Track OQ-1 |
| OQ-11 | ERC-20 in the lane. 8182 supports it with a per-note token field; Nero's token proofs were found incomplete on-thread. | deferred | After v0 spec for ETH |
| OQ-12 | Compliance hooks. 8182 punts to companion standards; Privacy Pools association proofs could ride on the unshield entry. | deferred | Companion doc |
| OQ-13 | Reorgs. Pre-signed lane txs die if the creation block is re-indexed (Nero thread). Does anchoring to N-1 plus the ring make this tolerable? | open | Analysis |
| OQ-14 | Political path. Nero declined ZK on the UTXO chassis; 8182 is already PFI'd with the simpler model. Is this pitched as 8182 v2, a new EIP, or a research post first? | open | Write the ethresear.ch post and see |

## 6. Ethereum roadmap dependencies

| EIP / track | Fork | Status (2026-09) | Why it matters here |
|---|---|---|---|
| EIP-7805 FOCIL | Hegotá (2027) | only confirmed Hegotá EIP; CL headliner | the committee and the enforcement rule |
| EIP-7732 ePBS | Glamsterdam (Q4 2026) | headliner, devnets | lets the proposer commit to the lane at t=0 without the payload |
| EIP-7928 Block-level access lists | Glamsterdam | headliner | formal way to declare the lane's access set as only the shielded system contract |
| EIP-8141 Frame transactions | Hegotá | CFI | self-funded spends of transparent UTXOs; sponsorship |
| EIP-8182 Private ETH and ERC-20 transfers | Hegotá | PFI, Review | pool semantics; the base this design extends |
| EIP-8250 Keyed nonces | Hegotá | draft | unlinkable parallel spends from one account |
| EIP-8272 Recent roots for frames | Hegotá | draft | a VERIFY-frame pattern for checking roots before account validation |
| EIP-7503 ZK Wormholes | none | stagnant | precedent for a native mint via a new tx type |
| EIP-7886 Delayed execution | none | stagnant | conceptual model: validity without execution |
| EIP-4444 history expiry | rolling | in progress | OQ-9 |
| The Verge / EIP-8025 | roadmap | research | the lane is a closed subsystem, a natural first target for validity proofs |

## 7. Prior art and sources

Primary-source notes with verbatim quotes live in [`docs/research/`](docs/research/). Full link list in [`docs/bibliography.md`](docs/bibliography.md).

- **Zcash Tachyon**: Sean Bowe's two posts (2025-04, 2025-05), the tachyon.z.cash overview and roadmap, the Ragu post (2026-05), and Bowe's forum statement on windowed nullifiers (2025-11). Notes: [`docs/research/01-zcash-tachyon.md`](docs/research/01-zcash-tachyon.md)
- **Native UTXOs on Ethereum** (Nero_eth, ethresear.ch, 2026-07) and the thread critiques. Notes: [`docs/research/02-native-utxos.md`](docs/research/02-native-utxos.md)
- **FOCIL** (ethresear.ch 2024-06, EIP-7805, CL/EL workflow post, Hegotá selection). Notes: [`docs/research/03-focil.md`](docs/research/03-focil.md)
- **EIP-8182** and its magicians thread. Notes: [`docs/research/04-eip-8182.md`](docs/research/04-eip-8182.md)
- **Ethereum privacy and block-pipeline roadmap** (ethereum.org privacy roadmap, Vitalik's maximally simple L1 privacy roadmap, PSE, Pierre's PQ private ETH, EIP-7503, EIP-7886, EIP-7928, Scourge/Verge). Notes: [`docs/research/05-ethereum-roadmap.md`](docs/research/05-ethereum-roadmap.md)
- **Multiple concurrent proposers** (Multiplicity, Neuder/Resnick, BRAID, a16z "MCP: Why and How", "Price of Censorship", "MEV in MCP"). Notes: [`docs/research/06-mcp.md`](docs/research/06-mcp.md)

## 8. Framing for the first public post

"A shielded lane for Ethereum: committee-built, appended, commutative with the payload, verified natively, consensus state equals a root ring plus a nullifier window." Cite EIP-8182's author on unprunable nullifier data and the unanswered aggregation question on that thread. Ship v0 on Groth16 BN254 so it is buildable today; describe v2 as the Tachyon path.

## 9. Repo map

```
README.md                      this status board
docs/design/spec-draft.md      draft spec v0.1 (normative language where decided)
docs/decisions/ADR-*.md        design decisions with alternatives
docs/research/0*-*.md          primary-source notes, verbatim quotes, dates
docs/bibliography.md           every URL used, grouped
CHANGELOG.md                   dated dossier changes
```

## 10. How to update this dossier

- A new fact goes into the relevant `docs/research/` note with a date and a quote or link. Never paraphrase a load-bearing claim without the source.
- A new decision gets an ADR. Update the table in Section 4 and move any answered OQ to `answered` with a pointer.
- A new question gets the next OQ number. Do not renumber.
- Every change gets a line in `CHANGELOG.md` and bumps "Last dossier update" above.
- Inferences are labeled as such. This dossier separates "what the sources say" from "what we think follows."

## 11. Changelog

See [`CHANGELOG.md`](CHANGELOG.md).
