# Territory World development board

Open the world menu on the building toolbar and select **Enter Territory World (dev)**. The same button returns to Home. Switch from the board view; neighbor inspection, training, and Endless exploration must be exited first.

The two boards retain separate cell snapshots and camera settings during the session. Home saves continue to use their existing storage. Territory edits are session-only and reset on page reload. Territory placement uses the shared editor without spending Home resources. Home save-slot actions and whole-board reset/import actions are unavailable while viewing Territory.

`assets/territory-world.js` supplies deterministic 50×50 cell data to the existing `applyState` pipeline. There is no additional renderer or animation loop. Terrain tops remain instanced, risers retain the existing bounded geometry, scenery is sparse, and the rocky island underside is shared. Home keeps its 64-level cap; Territory permits 160 levels (31.8 world units of rise). The generated mountain uses overlapping peaks and directional ridges. Low paths connect the four biome clearings. Home-only training and natural-terrain shield domes are omitted. A permanent shared transporter model stands on a protected snow apron in the ice corner. Walk into it in first person to use the existing wormhole to Endless exploration; H returns to the same Territory board, outside the transporter.

`window.__territoryDefenderAreas()` returns candidate clearings in grid coordinates with a radius, biome, and initial terrain level. These are areas, not fixed defender slots. Future placement should validate the *current* edited terrain, character footprint, and movement support, then use existing unified controllers. No roster, occupancy rules, battles, or contract integration are implemented.

Automated checks: `node tools/territory-world.test.js` covers deterministic generation, elevation limits, all terrain themes, connected clearings, independent snapshots/cameras, rollback, and persistence/resource isolation. Existing terrain/material and Home tests cover shared rendering contracts.

Manual review still needed in a WebGL browser:

- Inspect biome transitions, central ridges, lava channels, snow/ice shading, and the exposed rocky underside from orbit and flight.
- Walk the connecting paths and inspect tall cliffs for camera or collision issues.
- Place, rotate, and delete buildings in each biome; verify vegetation has no shields.
- Switch repeatedly after edits; confirm Home buildings, landmarks, terrain, and camera return unchanged.
- Check frame rate and shadows on lower-powered devices. Automated tests do not establish visual quality or browser performance.
