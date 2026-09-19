# ADR-0009: Every piece of state has one writer; value crosses through two delayed mailboxes

- Status: accepted
- Date: 2026-09-19
- Deciders: dmarzzz
- Supersedes: the deposit queue and block-end drain in ADR-0003; the transparent-UTXO unshield in ADR-0004
- Source: docs/redteam-2026-09-19-crossings.md findings 1, 2, 3, 4, 5

## Context
The thread's headline property is that the two lanes do not overlap. As specified through v0.1 that was false in three places.

1. The block-end drain inserted payload N's deposits into the same commitment tree as lane N's outputs. Every root a lane could anchor to was therefore co-written by the builder. Under ePBS that root has two candidate values (payload FULL or EMPTY) until beacon block N+1 picks a parent status, while the committee for lane N+1 must list by t=8 of slot N.
2. Unshield openings shared `next_utxo_index` with UTXOs minted by payload frame transactions, so a lane opening's index depended on the payload's mint count, and a claim signed against one index died on the other branch.
3. `vault_balance` was written by both sides with no stated invariant.

ADR-0003's reason for the queue ("lane proofs depend on the builder's deposit count") is also wrong at v0: EIP-8182 proofs bind the note body commitment and the contract assigns the leaf index at insert, so no prover commits to a position.

## Decision
Single writer, delayed reader. Each structure below has exactly one writing side. The other side may read it only after the stated delay.

| State | Writer | Other side reads | Delay |
|---|---|---|---|
| notes tree, `notes_root_ring` | lane | never | n/a |
| nullifier set | lane | never | n/a |
| deposit tree, `deposit_root_ring` | payload | lane, as an anchor | root of block M is readable by lane N only if M <= N-2 and payload M is FULL |
| credit outbox | lane | payload, as system credits | outbox of lane N is paid at the start of the next FULL payload |
| accounts, including the vault's ETH balance | payload | never | n/a |

Consequences of the table, stated as rules:

- Shielded state is a pure function of the lane sequence: `S[N] = f(S[N-1], lane[N], settled deposit roots)`. No payload content, and no payload FULL/EMPTY outcome in the last two blocks, can change it.
- Deposits are payload transactions that append `(commitment, value)` to the deposit tree directly. There is no queue and no block-end drain.
- A spend proves membership of each input in either the notes tree or the deposit tree. The circuit takes two public anchors (`notes_anchor`, `deposit_anchor`) and one private selector bit per input. Both trees use the same depth and hash, so the selector costs one constrained mux on the root comparison.
- `notes_root[N]` is known at t=0 of slot N, when lane N is committed. A note created in lane N is spendable in lane N+1. This is a true one-block respend.
- Deposit to first spend is two blocks (rule and practice now agree).
- An Unshield writes `(recipient, value)` to the credit outbox. The next FULL payload MUST begin by applying every outstanding credit as an unconditional balance increase with no code execution and no gas, in outbox order, up to `MAX_CREDITS_PER_PAYLOAD`. A payload that omits or reorders them is invalid. This is the EIP-4895 withdrawal pattern. Credits carry over across EMPTY slots and across the cap.
- Each credit decrements the vault's ETH balance. A credit that would overdraw the vault is skipped and stays in the outbox. The vault is a turnstile: a circuit bug is capped by the vault balance and cannot inflate ETH supply.
- The outbox is FIFO and paid at `MAX_CREDITS_PER_PAYLOAD` per FULL payload. Unshields are never dropped for capacity; they pay an excess fee that rises exponentially with outbox length (EIP-7002 pattern), so a backlog is a priced delay.
- The vault contract computes each deposit leaf from the ETH it actually received: `leaf = H(DEPOSIT_TAG, owner_commitment, value, deposit_index)`. Nullifier derivation includes the tree tag. Without these two rules a deposit could claim value it did not pay, or a position in one tree could shadow the other.
- Deposit roots cross to the shielded domain as EIP-7685-style requests, mirrored in a beacon-state ring and processed only for FULL parents. The read delay is enforced by this path, not by convention.
- A listed op that turns into a no-op because a reorg changed a deposit root's FULL/EMPTY status is not a lister fault; attribution is per branch and carries no penalty at v0.
- Lane tips, where present, are outbox credits to the slot proposer's fee recipient.
- Lane base-fee burn is accounted by the payload side as a system debit of the vault at the same point credits are paid. The lane itself never writes a balance.

## Alternatives
- Keep one tree and mandate an anchor lag of two blocks: fixes the ambiguity, keeps the builder as a co-writer of every root, keeps the drain and its insert-order rule.
- Keep transparent UTXOs for unshield with a lane-only index namespace `(block, position)`: keeps Nero's chassis and zero account writes, but keeps a second user transaction that a builder can delay, keeps the EIP-8141 dependency, and the claim's VERIFY frame reads vault state that the public mempool rules may reject (crossings red team, finding 4).
- Mint credits without decrementing the vault, as the beacon chain does: simpler accounting, removes the turnstile.

## Consequences
- "No overlap" becomes literally true in the form: no structure has two writers, and no side reads the other side's writes from the same block or the one before.
- The exit has no user transaction, so a builder has nothing to censor. Exit censorship resistance equals lane censorship resistance. Entry is still a visible public transaction and gets ordinary FOCIL protection, including its block-full excuse.
- The pattern is the one the beacon chain and the execution layer already use: requests in (EIP-6110, EIP-7685), system credits out (EIP-4895).
- Credits to contracts run no code, as with validator withdrawals.
- Dependencies removed: native UTXOs, EIP-8141 frames for the claim. Dependency added: a system-credit list in the payload, enforced like withdrawals.
- The circuit diverges from EIP-8182 by one selector per input and one extra public anchor.
- Privacy: `deposit_anchor` and `notes_anchor` are public. Wallets SHOULD draw both from a recent fixed-size window at random; a mandated per-lane anchor is left to OQ-2.
- Deposits still need a minimum value and a per-block cap with an excess fee (crossings red team, finding 5). OQ-5 is replaced by that question.
