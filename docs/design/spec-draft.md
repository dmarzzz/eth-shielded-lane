# Shielded Lane: draft spec v0.2

Status: draft, 2026-09-19. Normative words (MUST, SHOULD) are used only where an ADR has decided the point. Everything else is a placeholder marked TBD with the open question that resolves it. v0.2 applies ADR-0009 (single-writer state, mailboxes), ADR-0010 (per-op validity) and ADR-0011 (deferred lane root, own state domain). v0.1 is in git history.

## 1. Overview

A block consists of the execution payload (lane 1) and a shielded lane (lane 2). Lane 2 is an ordered list of shielded operations committed in the beacon block. Every piece of state has exactly one writing lane. Value crosses through two mailboxes, each written by one side and read by the other only after a delay: the deposit tree (payload to lane) and the credit outbox (lane to payload). Shielded state is a pure function of the lane sequence and of deposit roots at least two blocks old.

## 2. State

```
struct ShieldedState {                      // writer: lane. committed by shielded_state_root in BeaconState (ADR-0011)
    next_note_index   : uint64
    notes_root_ring   : bytes32[8192]       // notes root as of end of lane N at N mod 8192
    sealed_batches    : bytes32[]           // one per 8192 blocks; sealing invariant TBD (OQ-9)
    nullifier_state   : v0: set of revealed nullifiers (permanent; same cost as EIP-8182)
                        v2: window of nullifiers for the last W blocks (OQ-2)
    credit_outbox     : Credit[]            // { recipient: address, value: uint256 }, FIFO
    pending_burn      : uint256             // lane base fees, debited from the vault by the next FULL payload
}

struct DepositState {                       // writer: payload. lives in the vault system contract
    next_deposit_index: uint64
    deposit_root_ring : bytes32[8192]       // deposit tree root as of end of payload N at N mod 8192
    vault ETH balance                       // turnstile: credits are paid from it, never minted
}
```

Note contents, deposit leaves and (v2) historical nullifiers live in history and are proven on demand.

## 3. Lane operations

```
enum LaneOp {
    Transfer  { proof, notes_anchor, deposit_anchor, nullifiers[2], out_commitments[3], fee, out_note_data[3] }
    Unshield  { proof, notes_anchor, deposit_anchor, nullifiers[2], out_commitments[2], fee,
                credit_out: { recipient: address, value: uint256 } }
}
```

- Each input is proven to be a member of the notes tree under `notes_anchor` or of the deposit tree under `deposit_anchor`, chosen by a private selector bit per input (ADR-0009).
- `out_commitments` are note body commitments. Leaf positions are assigned at insert, as in EIP-8182; no proof commits to a position.
- `fee` is paid from consumed value (ADR-0006). Conservation: `sum(in) == sum(out) + credit_out.value + fee`, enforced in the proof with `fee` as a public input.
- Nullifier reveals happen ONLY in the lane (ADR-0008). The payload MUST NOT spend shielded notes.
- Unshields are never rejected for capacity. The outbox is FIFO and is paid at `MAX_CREDITS_PER_PAYLOAD` per FULL payload; an Unshield pays an excess fee that rises exponentially with outbox length (EIP-7002 pattern), so a backlog is a priced delay, not a dropped op.
- Deposits are NOT lane operations. A deposit is a payload transaction that pays `value >= MIN_DEPOSIT` into the vault with an `owner_commitment`. The vault contract computes the leaf itself, `leaf = H(DEPOSIT_TAG, owner_commitment, value, deposit_index)`, from the ETH actually received, and appends it to the deposit tree. A depositor never supplies an opaque leaf, so a deposit cannot claim more value than it paid. Per-block cap and excess fee: TBD (OQ-5).
- Nullifier derivation MUST include the tree tag (`NOTE_TAG` or `DEPOSIT_TAG`) and the leaf, so a position in one tree can never produce the nullifier of a position in the other.
- Each block's `deposit_root` reaches the shielded domain as an execution-layer request (EIP-7685 pattern) and is mirrored in a ring in the beacon state, processed only when the parent payload is FULL. This is what makes the two-block read delay mechanical rather than a convention. Precedent for the size: `block_roots` and `state_roots` are already 8192-entry vectors in `BeaconState`.

## 4. Op validity (decided per op, at apply time)

A lane cannot be invalid (ADR-0010). Lane order is canonical: by (committee member index, position in that member's list), duplicates removed by op hash.

```
def op_effective(S, D, N, op, seen) -> bool:
    if op.notes_anchor   not in S.notes_root_ring as of end of lane N-1:            return False
    if op.deposit_anchor not in D.deposit_root_ring for FULL payloads M <= N-2:     return False
    if any(n in S.nullifier_state or n in seen for n in op.nullifiers):             return False   # first in order wins
    if op.fee < lane_base_fee(N):                                                   return False   # OQ-4
    if not verify(op.proof, public_inputs(op)):                                     return False   # v0: batchable
    return True
```

An op that is not effective is a no-op: it writes nothing, pays nothing and takes no leaf positions. It is attributable to the member who listed it.

## 5. Lane application

```
def apply_lane(S, D, N, lane):
    seen = set(); burned = 0; tips = 0
    for op in lane.ops:                                   # canonical order
        if not op_effective(S, D, N, op, seen): continue
        seen.update(op.nullifiers); S.nullifier_state.add(op.nullifiers)
        for c in op.out_commitments: insert(S.notes, c, S.next_note_index++)
        if op is Unshield: S.credit_outbox.push(op.credit_out)      # fee includes excess_fee(len(outbox))
        burned += lane_base_fee(N); tips += op.fee - lane_base_fee(N)
        emit LaneOutput(op.out_note_data)
    if tips: S.credit_outbox.push({recipient: proposer_fee_recipient, value: tips})
    S.pending_burn += burned
    S.notes_root_ring[N % 8192] = root(S.notes)
    v2: S.nullifier_window.push(seen); S.nullifier_window.pop_older_than(N - W)
```

`apply_lane` reads no account and no payload content. It runs whether payload N is FULL, EMPTY or invalid.

Payload side, at the start of every FULL payload, before any transaction:

```
def pay_outbox(D, S):
    debit(vault, S.pending_burn); S.pending_burn = 0      # base-fee burn
    paid = 0
    while S.credit_outbox and paid < MAX_CREDITS_PER_PAYLOAD:
        c = S.credit_outbox.peek()
        if vault.balance < c.value: break                 # turnstile: insolvency halts all exits behind it, on purpose
        vault.balance -= c.value; balance[c.recipient] += c.value    # unconditional, no code, no gas (EIP-4895 pattern)
        S.credit_outbox.pop(); paid += 1
```

A payload whose credits differ from this list is invalid. The list is fully determined by lanes committed at least one slot earlier.

## 6. Beacon block fields

- `shielded_lane_root`: commitment to the ordered op hashes of lane N. Committed by the proposer at t=0 alongside the ePBS bid. Op bodies travel as a sidecar on the lane topic.
- `shielded_state_root`: root of `ShieldedState` as of the end of lane N-1 (ADR-0011). Attesters of block N check it; they have had a full slot to compute it.
- v0 has no lane proposer or aggregator. v1/v2: TBD (OQ-3).
- Engine API additions (ADR-0011): `lane_apply(N, ops)` returning the new `shielded_state_root`; `nullifier_lookup(nullifiers[])`; `outbox_view()` so the execution client can build and check `pay_outbox`.

## 7. Inclusion enforcement (ADR-0007, ADR-0010)

- Each op is listable by exactly `r` committee members, chosen by `min(op.nullifiers) mod 16` (OQ-18; initial `r` = 3). Members list lane ops in a lane-specific inclusion list (OQ-16) and MUST verify an op before listing it.
- Attesters MUST reject a block whose lane omits the hash of an op that appeared in a committee list they saw before the view freeze, and MUST hold the body of every op hash in the lane before attesting. Neither check verifies a proof or reads state.
- Lane mempool nodes relay only the first op seen for a given nullifier.
- Lane ops carry no sender field and are gossiped in the open on the lane topic. Content is private; network origin is not. Wallets SHOULD submit through a relay that hides origin (OQ-19).
- Equivocation handling: TBD (OQ-3).

## 8. Resource lane (ADR-0006)

- `LANE_GAS_LIMIT`, `lane_base_fee` with its own EIP-1559-style update: TBD (OQ-4).
- Cost per op is a function of its shape only.

## 9. Crossings

| Direction | Mechanism | Earliest |
|---|---|---|
| public -> shielded | payload tx: ETH to the vault, commitment to the deposit tree | spendable in lane N+2 if payload N is FULL |
| shielded -> shielded | lane op; outputs enter the notes tree | spendable in lane N+1 |
| shielded -> public | lane Unshield writes a credit to the outbox | paid at the start of the next FULL payload (N+1); no user transaction |
| shielded -> public, atomic with an EVM action | not supported; nullifiers are revealed only in the lane (ADR-0008) | n/a |

## 10. v2 additions (Tachyon path)

- Per-block nullifier commitment (sorted set root) stored alongside the ring.
- A spend of a note created at block B with anchor at block A proves in-circuit that its nullifier chain was not revealed in any block in (B, A], folding per-block non-membership proofs (PCD). The client checks (A, N-1] against the window. Hence W MUST cover the maximum acceptable staleness of A (OQ-2).
- Nullifier derivation inverted per Tachyon so an oblivious service can extend the PCD without learning the note (OQ-8).
- Proof system: OQ-1.

## 11. Constants

| Name | Value | Decided by |
|---|---|---|
| `ROOT_RING_SIZE` | 8192 | ADR-0003 (from Native UTXOs) |
| `COMMITTEE_SIZE` | 16 | EIP-7805 |
| `LISTER_REDUNDANCY` (`r`) | 3, provisional | OQ-18 |
| `MIN_DEPOSIT_ANCHOR_LAG` | 2 blocks, FULL payloads only | ADR-0009 |
| `MAX_CREDITS_PER_PAYLOAD` | TBD (validator withdrawals use 16) | OQ-5 |
| `MIN_DEPOSIT`, deposit cap and excess fee | TBD | OQ-5 |
| `LANE_GAS_LIMIT`, lane base fee update | TBD | OQ-4 |
| nullifier window `W` (v2) | TBD | OQ-2 |

## 12. Not specified yet

lane gossip privacy (OQ-19), deposit bounds (OQ-5), the v2 rule for no-ops under one aggregate (OQ-3), ERC-20 (OQ-11), compliance hooks (OQ-12), reorg handling for pre-signed ops (OQ-13), history-expiry sealing (OQ-9), PQ migration (OQ-10).
