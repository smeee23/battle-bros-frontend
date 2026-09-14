# BattleBros frontend guidance

Read `../AGENTS.MD` first; it is authoritative for game rules.

This app is a transitional single-file Three.js r128 frontend derived from the
Ether Wars visual world. The main app is `index.html`. Keep the renderer,
`world`, `cellMeshes`, and `setCell` contracts stable unless a deliberate
extraction provides equivalent tests.

- BattleBros is not a tournament, table, colony, or elimination game.
- Buildings and terrain are visual concepts unless an authoritative BattleBros
  contract/schema explicitly says otherwise.
- Do not revive Ether Wars S3 paths, manifests, resource catalogs, AWS drafts,
  or tournament state as BattleBros data sources.
- Canonical public schemas live in `../battle-bros-contracts/schemas`. Update
  frontend copies with `npm run schemas:sync`; never edit them manually.
- JSON/API onchain integers are decimal strings; use `bigint` for arithmetic.
- Keep unrevealed decisions, salts, signatures, and reveal packages out of
  public state, logs, URLs, analytics, and local export metadata.
- Preserve Three.js r128, geometry/material caches, instancing, progressive
  rendering, render windows, set-based animation indexes, capped DPR, and the
  single animation/render loop.
- Use `npm test` and `npm run build` before handoff.
- Work efficiently and protect my Codex usage allowance. Do not repeatedly investigate the same issue or make unnecessary tool calls. If your initial approach stalls, stop rather than repeatedly retrying. Prefer targeted file inspection over broad repository exploration. Once you have enough context, implement the requested change and run only the tests needed to validate it. If you encounter a blocker that cannot be resolved efficiently, stop and report the blocker rather than consuming substantial additional compute.
