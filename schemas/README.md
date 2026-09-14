# Indexed JSON documents

This directory defines the canonical public JSON interface between the future
BattleBros indexer/publisher and frontend. PostgreSQL is the backend source of
truth. S3 is only a publication layer. The interface deliberately separates a
mutable confirmed-current document from immutable historical snapshots.

- `*.schema.json` files are JSON Schema Draft-07 validation schemas.
- `*.example.json` files form one representative finalized-round bundle.
- `definitions.schema.json` contains shared exact-integer, address, hash,
  snapshot, combat, and event-reference definitions.

## Publication boundary

`RoundOpened(N+1)` is the canonical publication trigger for finalized round N
after its block is confirmed. The deployment-time `RoundOpened(1)` is the sole
exception: it initializes the first round and does not finalize round 0. Every
later `RoundOpened` is emitted only after the preceding round's required
lifecycle work is complete. For a non-empty round that includes settlement or
cancellation, this means Need processing or expiry and entrant cleanup have
finished and `RoundCleaned(N)` was emitted earlier in the same transaction. For
an empty round, `RoundSkipped(N)` is emitted earlier in the same transaction.

Consumers derive the finalized round ID as `openedRoundId - 1`, but must derive
its outcome from the preceding round events: `RoundSkipped` identifies an empty
round, `RoundCancellationCompleted` identifies a cancellation, and battle and
bye terminal events distinguish resolved and bye-only results. `RoundOpened`
is a universal completion boundary, not an outcome classification event.

At this boundary, `manifest.latestFinalizedRound` is N while
`game-state.activeRound.roundId` is N+1. Never derive the manifest's finalized
round from the live `activeRoundId` getter alone.

The publisher should assemble each finalized historical bundle from one
repeatable-read database snapshot anchored to the end of the confirmed
`RoundOpened(N+1)` block. Upload and verify an immutable snapshot prefix first,
then replace `manifest.json` last. The manifest's `finalizedRounds` list is the
authoritative historical directory; consumers must not discover snapshots by
listing object storage.

`timing.finalizedTimestamp` is the timestamp of the canonical block containing
`RoundOpened(N+1)`. `lifecycleBlocks.finalizedBlockNumber` and
`finalizedBlockHash` identify that same block.

`lifecycleBlocks.registrationClosedBlockNumber` and
`registrationClosedBlockHash` are nullable when registration closure is not
applicable or cannot be established from canonical events. They must either
both be populated or both be null. Randomness uses `applicable: false` and null
result fields for skipped, bye-only, or incomplete-matchmaking-cancelled rounds
that never request resolution randomness. `completion.randomnessFulfilled` is
null in those cases; false means randomness was applicable but did not fulfill.

## Documents

- `manifest.json` points to immutable historical bundles, retains finalized
  snapshot identities, and advertises the independently mutable current-state
  path.
- `current/game-state.json` is overwritten as confirmed active-round state
  advances. Its `snapshot` identifies its own confirmed block and is not
  required to equal the latest finalized historical snapshot.
- `rounds/{roundId}.json` is the permanent round record: entrants, pairings,
  revealed decisions, outcomes, randomness, Need attempts, settlement totals,
  and explicit completion markers. There are no table documents.
- `battle-bros/{tokenId}.json` publishes the NFT's current snapshot plus its
  ascending event-derived history at an immutable finalized-round boundary.
  Lazy training entries include resulting reserves, every carry, and the
  remainder cursor, allowing exact replay.

Mutable current state must never be embedded into or overwrite a finalized
round bundle. A current-state update is generated only from confirmed canonical
PostgreSQL projections, may occur several times during a round, and does not
create a new finalized-round manifest entry.

## Event interpretation rules

- Matchmaking v1 preserves registration order: entrants `[A,B,C,D,E]` become
  pairs `A+B`, `C+D`, with `E` receiving the bye. The backend stores an
  algorithm identifier such as `registration-order-v1`; no onchain plan hash is
  required.
- `RoundCancellationStarted.failureReason = 0` means incomplete matchmaking;
  `1` means randomness failure. A cancelled round publishes
  `cancellationReason` using the corresponding schema enum.
- `BattleResolutionFailed` is an operational diagnostic fact only. Preserve its
  raw reason bytes and log identity, but never treat it as terminal. Only a
  later `BattleResolved`, `BattleVoided`, or `BattleCancelled` determines final
  battle state.
- `StakeSettled.feeShares` and `feeRecipient` are the authoritative fee-accrual
  facts. `round.totals.feeSharesAccrued` is their deterministic sum. No separate
  fee-accrual event is required.

## Encoding and derivation rules

All Solidity integers are base-10 strings. TypeScript implementations must use
`bigint`, never JavaScript `number`, before serializing. Addresses and hashes are
`0x`-prefixed hexadecimal strings and should be normalized to lowercase in the
database. All documents in a bundle must share chain ID, BattleManager address,
snapshot ID, block number, block hash, and timestamp.

History arrays are ordered ascending by round, then block number and log index.
`eventReference` fields make ledger entries auditable against canonical logs.
Revealed decisions are public after reveal; commitments, salts, signatures,
failed relayed reveal payloads, and any unrevealed preimages must not be
published. Standard ERC-721 `Transfer` events provide ownership history.

Events provide both historical transitions and the inputs for current derived
values. Level and capacity are derived from BattleBros progression state. For
stETH-denominated values, the indexer must also consume `TokenRebased` events
from the canonical Lido stETH proxy in global block, transaction, and log order.
The event's `postTotalEther` and `postTotalShares` form a global rate checkpoint
used lazily at the publication boundary; a rebase must not cause every indexed
BattleBro row to be rewritten.

At snapshot block B, use the latest canonical Lido rate checkpoint at or before
B to reproduce the deployed vault's integer conversions:

```text
positionShares = freeShares + reservedShares
currentValue = floor(positionShares * postTotalEther / postTotalShares)
requiredProtectedShares = the least share amount whose converted value is
                          at least protectedPrincipal
riskableShares = min(freeShares,
                     max(positionShares - requiredProtectedShares, 0))
yieldRatioBps = max(currentValue - protectedPrincipal, 0)
                * 10_000 / protectedPrincipal
```

The indexer must bootstrap from the last canonical `TokenRebased` event before
the BattleBros deployment, or from one initial block-pinned Lido read. It must
track stETH proxy upgrades, preserve rate checkpoints across normal operation,
roll them back on reorgs, and use Solidity-compatible integer arithmetic.
Block-pinned `getPooledEthByShares`, `getSharesByPooledEth`, and
`sharesOf(vault)` calls are optional reconciliation checks rather than the
primary publication data source. `sharesOf(vault)` is still useful for detecting
unsolicited transfers that are intentionally outside the attributable-position
event ledger.

Draft-07 cannot enforce cross-document relationships or arithmetic invariants.
The publisher must additionally verify that:

- every `battleBroIds` entry has a matching BattleBro document;
- every round entrant exists and is assigned exactly once to a battle or bye;
- battle participants and per-token history agree;
- round totals equal the included battle, XP, stake, and Need ledgers;
- snapshot identities match across the complete bundle;
- `totalFreeShares + totalReservedShares + totalFeeShares = accountedShares`.
