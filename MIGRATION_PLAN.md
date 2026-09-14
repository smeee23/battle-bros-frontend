# Ether Wars frontend migration plan

This frontend is bootstrapped from the current working copy of
`../../tiny-world-builder/tiny-world-builder.html`. The migration deliberately
keeps its single-file Three.js r128 presentation foundation while putting a
BattleBros-specific boundary in front of game data.

## Classification

### REUSE AS-IS

- Three.js r128 and GLTFLoader runtime.
- Scene, terrain, tile and building factories; world/cell mesh model; `setCell`.
- Cached geometry/materials, instancing, progressive rendering and render-window
  optimizations.
- Camera modes, orbit/pan/zoom, first-person navigation and WebXR presentation.
- Lighting, shadows, weather, particles, smoke, clouds, crop duster, ambient
  vehicles, crowd layer, audio and minimap.
- Local world editing, import/export and visual render settings.
- Visual assets under `vendor/`, `models/`, `sounds/`, and `crowd/`.

### REUSE WITH RENAMING

- Product title, visible brand, welcome copy, accessibility labels and export
  metadata: EtherWars/Tiny World -> BattleBros.
- Browser-local storage keys and exported globals use new `battle-bros` names.
  Legacy keys are read-only migration aliases where retaining user worlds is
  safe; network/data identifiers are not aliased.
- Runtime route and build output use `battle-bros-frontend`/`index.html`.

### ADAPT FOR BATTLEBROS

- The right-side game panel is BattleBro-centric and backed by a small frontend
  adapter rather than tournament/player/colony snapshot records.
- The initial adapter uses clearly labelled mock data with decimal-string
  integer boundaries. It exposes seams for ownership/state, Needs, reserves,
  training weights, registration, matchmaking, commit/reveal, battle history,
  XP/level, yield, protected principal and the current active round.
- World editing bypasses Ether Wars resource costs/effects. Buildings remain
  visual frontend concepts until a BattleBros authority explicitly links them.
- Surrounding land/ghost boards remain visual scenery only. They do not imply
  colonies, tournament seats, opponents, ownership, or matchmaking.

### REMOVE OR DISABLE

- Ether Wars S3 manifest/snapshot hydration at boot.
- Tournament, table, seat, landlord, colony and expansion UI.
- Gold/mining/infrastructure/population economy rows and building-resource
  accounting in active edit paths.
- Ether Wars AWS draft load/save/delete, colony transfers, round-history UI and
  tournament action controls.
- Ether Wars commit-preview hashing. BattleBros commit/reveal must later use the
  deployed BattleManager's exact ABI/encoding and authoritative round identity.
- Source mock tournament/table/player/colony JSON, synchronized Ether Wars
  schemas, S3 scripts and credential-bearing local configuration.

## Hidden-dependency audit

The source couples visible building actions to `RESOURCE_BUILD_RULES` through
`trySpendForPlacementWithReplacement`, `applyCatalogCellMutation`, and erase
refund helpers. The BattleBros fork keeps these legacy functions temporarily to
reduce rendering risk, but a migration flag makes them resource-neutral before
any active edit path reaches them. Boot also skips snapshot hydration and the
old phase timer. The old DOM is retained hidden as a compatibility scaffold for
legacy functions until those sections can be extracted without destabilizing
the monolith; it is not a live source of BattleBros state.

## Integration sequence

1. Define a versioned BattleBros frontend read model owned by the backend/API
   project, using decimal strings at JSON boundaries and `bigint` internally.
2. Replace the mock adapter with current BattleBro ownership/state reads and an
   indexed historical battle feed.
3. Add wallet/network handling and confirmed transaction flows for hatch/care,
   training weights, registration, commitments, direct/signed reveals and
   unlocked withdrawal.
4. Connect active-round schedules and matchmaking state without reviving
   tournament/table/colony assumptions.
5. Decide whether edited worlds/customization become local-only cosmetics or a
   versioned backend model; do not infer this from Ether Wars S3 paths.

## Implemented read-model milestone

- Frontend copies of the contracts-owned v1 schemas are synchronized through
  `npm run schemas:sync` and checked for drift in `npm test`.
- `hydrateBattleBrosReadModel()` loads the manifest, confirmed mutable game
  state, and one current BattleBro document. Runtime configuration uses
  `window.__battleBrosPublicData = { manifestUrl, tokenId }`.
- The validator rejects unsupported versions, malformed integer/address/hash
  fields, cross-chain/contract/snapshot mismatches, token/supply mismatches,
  invalid reserve capacity, invalid training-weight totals, inconsistent Need
  state, and unreconciled position shares.
- Normalized domain values use `bigint`; only formatted strings reach the UI.
- Local development uses canonical example documents. Production remains on
  labelled mock state until an explicit publication URL is configured.
- Registration, matchmaking, commitment and reveal details remain unavailable
  rather than inferred because canonical v1 current documents do not publish
  those per-BattleBro fields yet.
