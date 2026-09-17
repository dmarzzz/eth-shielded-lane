# Zcash Tachyon: primary-source notes

Last reviewed: 2026-09-17. Quotes are verbatim from the linked sources.

## What Tachyon is

Sean Bowe, "Tachyon: Scaling Zcash with Oblivious Synchronization" (2025-04-02):

- Problem statement: "every time any user creates a shielded transaction in Zcash: the network must ensure that the revealed nullifier has never been seen before; the network must record the nullifier so that it cannot be repeated again; and, all other users must account for the newly created note commitments by updating their set inclusion witnesses for all of their unspent shielded notes."
- Recipients today "trial decrypting every transaction until they identify payments sent to them. This simply does not scale." Tachyon moves payment secrets out of band.
- Nullifier derivation is inverted: "nullifiers need to be changed so that they are not determined by the note commitment but rather the other way around." This is what lets an oblivious sync service work without learning the note.
- Node state: validators need only check "the most recent block(s) do not contain the revealed nullifier."
- PCD: "allows data to live alongside proofs of its own correctness so that when it is combined with other (proof-carrying) data the mixture inherits and extends the original proofs of correctness."
- Aggregation: "Almost everything in a block can be permanently pruned by validators."
- Rollout order stated in the post: out-of-band payments (wallet change) -> shielded transaction aggregation via PCD -> nullifier derivation change -> new accumulator -> removal of in-band secret distribution -> wallet PCD state.

Sean Bowe, forum post 2025-11-04 (Zcash Community Forum, "Scaling Zcash: Tachyon. Ragu"):

- "Validators must only maintain the leading edge of revealed nullifiers (to prevent duplicates in concurrent transactions) but can otherwise permanently prune the nullifiers and everything else about the Tachyon transaction history."
- Users will "recursively prove all of their 'previous nullifiers' were not revealed in previous blocks, and reveal only the most recent nullifier(s) in their transaction."
- Users can "outsource the generation of this proof to an untrusted third party service which never learns the nullifiers the user actually reveal on chain."

Sean Bowe, "Tachyaction at a Distance" (2025-05-15):

- "Tachyon removes in-band secret distribution, meaning the Zcash blockchain cannot be (easily) used to communicate with your counterparty."
- Notes contain only payment key, value, randomness. Diversifiers and the unique value are dropped. RedPallas re-randomization, homomorphic value commitments and binding signatures retained.

tachyon.z.cash overview:

- Today "every validator must store all revealed nullifiers forever, leading to runaway state growth: gigabytes per day even at modest TPS."
- Block producers can "aggregate shielded transactions without user coordination, cutting marginal size and verification cost and boosting block capacity."
- Oblivious sync: the service "never learns your actual nullifiers, because the protocol forces them to periodically evolve in an unlinkable way."

## Proof stack: Ragu

"Folding Tachyon with Ragu" (tachyon.z.cash blog, 2026-05-07): Ragu is "a production-grade realization of the original Halo paper", using "the Pasta elliptic curve cycle, the original Poseidon algebraic hash function, univariate polynomial multi-commitment schemes using inner product arguments." No trusted setup. Repo: github.com/tachyon-zcash/ragu. Labeled "under heavy development and not yet audited." No benchmarks published as of review date.

Roadmap page lists four goals: Ragu -> payment protocol -> "a new shielded pool independent of the existing Orchard pool" -> mainnet activation. No dates.

## Zcash network status (context)

CoinDesk Research, 2026-06-30 (updated 07-29): first release candidate on testnet 2026-05-22 with 25-second blocks and doubled Orchard throughput; NU6.3 "Ironwood" fast-tracked mid-2026; NU7 carries fee burn and quantum recoverability. Tachyon proper is not in NU7.

## What we take from it

- The state model: root/anchor ring + nullifier window, everything else prunable. This is the "nodes don't sync the state" property.
- The user-side cost: users (or a service) maintain PCD. This is OQ-8.
- The proof system does not transfer to Ethereum as-is (OQ-1).

## Sources

- https://seanbowe.com/blog/tachyon-scaling-zcash-oblivious-synchronization/
- https://seanbowe.com/blog/tachyaction-at-a-distance/
- https://forum.zcashcommunity.com/t/scaling-zcash-tachyon-ragu/50789
- https://tachyon.z.cash/overview/
- https://tachyon.z.cash/roadmap/
- https://tachyon.z.cash/blog/folding-tachyon-with-ragu/
- https://github.com/tachyon-zcash/ragu
- https://www.coindesk.com/research/building-the-zcash-machine-tachyon-and-quantum-readiness
