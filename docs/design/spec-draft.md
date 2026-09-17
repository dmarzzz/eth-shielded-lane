# Shielded Lane: draft spec v0.1

Status: draft, 2026-09-17. Normative words (MUST, SHOULD) are used only where an ADR has decided the point. Everything else is a placeholder marked TBD with the open question that resolves it.

## 1. Overview

A block consists of the execution payload (lane 1) and a shielded lane (lane 2). Lane 2 is a list of shielded operations, a lane commitment in the beacon block, and (v1/v2) an aggregate proof. Lane 2 is applied after lane 1 and MUST NOT read or write any state outside the shielded system contract and the vault.

## 2. Consensus state of the shielded system

```
struct ShieldedState {
    next_leaf_index     : uint64
    next_utxo_index     : uint64            // transparent UTXO chassis (Nero)
    commitment_root_ring: bytes32[8192]     // root as of end of block N at N mod 8192
    sealed_batches      : bytes32[]         // one per 8192 blocks; sealing invariant TBD (OQ-9)
    openings_root_ring  : bytes32[8192]     // transparent UTXO openings (Nero)
    nullifier_state     : v0: bitfield keyed by nullifier index
                          v2: window of nullifiers for the last W blocks (OQ-2)
    deposit_queue       : Deposit[]         // drained at block end (ADR-0003)
    vault_balance       : uint256 (ETH); per-token for ERC-20 (OQ-11)
}
```

Nodes keep nothing else for the shielded system. Note contents, openings, and (v2) historical nullifiers live in history and are proven on demand.

## 3. Lane operations

```
enum LaneOp {
    Transfer  { proof, anchor_root, nullifiers[2], out_commitments[3], fee, out_note_data[3] }
    Unshield  { proof, anchor_root, nullifiers[2], out_commitments[2], fee,
                utxo_out: { recipient: address, value: uint256 } }
}
```

- `anchor_root` MUST be in `commitment_root_ring` as of the end of block N-1 (ADR-0003).
- `nullifiers` MUST NOT appear in `nullifier_state` (v0: bit unset; v2: not in window) and MUST NOT repeat within the lane. First occurrence wins; later conflicting ops are dropped without invalidating the lane.
- `fee` is paid from consumed value (ADR-0006). Conservation: `sum(in) == sum(out) + utxo_out.value + fee`, enforced in the proof with `fee` as a public input.
- `Unshield.utxo_out` is appended to the transparent UTXO openings for block N with index `next_utxo_index++`. No account state is written (ADR-0004).
- Nullifier reveals happen ONLY in the lane (ADR-0008). The payload MUST NOT spend shielded notes.
- Deposits are NOT lane operations. A deposit is a payload transaction that pays into the vault with an `ownerCommitment` and is queued.

## 4. Lane validity (client check)

```
def lane_valid(state_after_payload, lane) -> bool:
    S = shielded view of state as of end of block N-1     # ADR-0003
    for op in lane.ops:
        assert op.anchor_root in S.commitment_root_ring
        assert op.fee <= lane.max_fee_per_op                # OQ-4
    assert gas(lane) <= LANE_GAS_LIMIT                       # ADR-0006
    v0: assert batch_verify_groth16([op.proof for op in lane.ops], public_inputs)
    v1: assert verify(lane.member_aggregates[i]) for each committee member i
    v2: assert verify(lane.aggregate, commit(lane.ops))
    # nullifier conflicts are checked during application, not here
    return True
```

## 5. Lane application (state transition, after payload)

```
def apply_lane(S, lane):
    seen = set()
    for op in lane.ops:
        if any(n in S.nullifier_state or n in seen for n in op.nullifiers): continue  # drop
        seen |= set(op.nullifiers)
        mark_spent(S, op.nullifiers)
        for c in op.out_commitments: insert(S, c, S.next_leaf_index++)
        if op is Unshield: append_opening(S, op.utxo_out, S.next_utxo_index++)
        burn(S.vault, base_fee_lane); credit_tip(lane.proposer, op.fee - base_fee_lane)
        emit LaneOutput(op.out_note_data)
    for d in S.deposit_queue: insert(S, d.commitment, S.next_leaf_index++)   # ADR-0003
    S.deposit_queue = []
    S.commitment_root_ring[N % 8192] = root(S.tree)
    S.openings_root_ring[N % 8192]   = root(openings_of_block_N)
    v2: S.nullifier_window.push(seen); S.nullifier_window.pop_older_than(N - W)
```

## 6. Beacon block fields

- `shielded_lane_root`: commitment to `lane.ops` (and aggregate where present). Committed by the proposer at t=0 alongside the ePBS bid.
- `shielded_lane_proposer`: TBD (OQ-3).

## 7. Inclusion enforcement (ADR-0007)

Committee members MAY include lane ops in their inclusion lists. Attesters MUST reject a block whose lane omits a committee-listed op that satisfies Section 4 and whose nullifiers were unspent as of end of N-1. Equivocation handling: TBD (OQ-3).

## 8. Resource lane (ADR-0006)

- `LANE_GAS_LIMIT`, `lane_base_fee` with its own EIP-1559-style update: TBD (OQ-4).
- Cost per op is a function of its shape only.

## 9. Crossings

| Direction | Mechanism | Latency |
|---|---|---|
| public -> shielded | payload tx into vault, queued, drained at block end | spendable at N+1 |
| shielded -> public | lane Unshield emits transparent UTXO | spendable at N+1 via frame tx in payload |
| shielded -> public, atomic with EVM action | not supported; nullifiers are revealed only in the lane (ADR-0008) | n/a |

## 10. v2 additions (Tachyon path)

- Per-block nullifier commitment (sorted set root) stored alongside the ring.
- A spend of a note created at block B with anchor at block A proves in-circuit that its nullifier chain was not revealed in any block in (B, A], folding per-block non-membership proofs (PCD). The client checks (A, N-1] against the window. Hence W MUST cover the maximum acceptable staleness of A (OQ-2).
- Nullifier derivation inverted per Tachyon so an oblivious service can extend the PCD without learning the note (OQ-8).
- Proof system: OQ-1.

## 11. Not specified yet

ERC-20 (OQ-11), compliance hooks (OQ-12), reorg handling for pre-signed ops (OQ-13), history-expiry sealing (OQ-9), PQ migration (OQ-10).
