# BattleBros frontend

This is the first-pass BattleBros frontend, bootstrapped from the Ether Wars
single-file Three.js world. It preserves the existing terrain, buildings,
camera/navigation, minimap, visual effects, and rendering optimizations while
isolating the old tournament/colony/resource systems.

The frontend loads the backend's versioned manifest/current-state read model.
`npm run build` generates `runtime-config.js` from
`deployment/public-data.json` and the current backend deployment manifest, so a
new simulation deployment can change the BattleManager address without editing
HTML. Environment variables override deployment values:

- `BATTLEBROS_MANIFEST_URL` (highest-priority complete URL)
- `BATTLEBROS_PUBLIC_DATA_ORIGIN`
- `BATTLEBROS_S3_BUCKET`, `BATTLEBROS_AWS_REGION`, `BATTLEBROS_S3_PREFIX`
- `BATTLEBROS_DEPLOYMENT_MANIFEST`, `BATTLEBROS_CHAIN_ID`, `BATTLEBROS_BATTLE_MANAGER`
- `BATTLEBROS_DEFAULT_TOKEN_ID`

When no token ID is configured, the UI selects the first BattleBro ID in the
published current game state. The browser receives no AWS credentials and uses
anonymous read-only HTTP GETs. Local canonical fixtures remain available by
removing/renaming `runtime-config.js` or supplying a query-string `manifestUrl`.
No wallet transaction or contract write is implied.

```bash
npm test
npm run build
npm run dev
```

Open <http://localhost:3000/>. See `MIGRATION_PLAN.md` for the classification,
hidden-dependency audit, and backend/contract integration sequence.

### Lava visual evolution

All seven Lava forms currently cycle expressions in the normal world about
every nine seconds, with staggered starts and different initial expressions.
This temporary visual cycle requires no URL flag. An explicit
`setBattleBroExpression` call pauses automatic cycling on that character; set
`root.userData.expressionCycleEnabled = true` to resume it.

For manual inspection, open
<http://localhost:3000/?expressionDemo=1>. The preview starts on a little smile, focuses the selected character, and
automatically cycles every 2.5 seconds. Use **Pause cycle** or choose an
expression to inspect it; **Next expression** advances manually. **Focus**
centers and zooms the camera on the selected head. **Close** restores neutral.
The query flag works on any host and only controls the optional preview UI.

Gameplay presentation can call `setBattleBroExpression(root, name)` with
`neutral`, `littleSmile`, `bigSmile`, `laughing`, `sad`, `crying`, `mildAngry`, or
`veryAngry`. Transitions take 0.24 seconds; `{ immediate: true }` applies the
pose immediately for previews. Facial poses compose with blinking, reuse
geometry, and do not control body animation or gameplay state.

`createRockBattleBro({ variant: 'lava', form: 3 })` selects the adolescent.
Omitting `form` selects the original mature Lava Monster, now Form IV.
These are frontend visual stages, not an onchain evolution rule.

| Form | Stage | Status |
| --- | --- | --- |
| I | Newborn | Small head/core and two crude contact limbs |
| II | Developing | Early shoulders, sparse core and segmented juvenile limbs |
| III | Adolescent / Late Developing | Accumulated core/shoulder/wrist rocks, stronger alternating reach–plant–pull gait |
| IV | Mature Lava Monster | Original mature morphology and hand-walking animation |
| V | Greater | Planned only |
| VI | Apex | Four-limbed endpoint with inherited support legs, open molten torso, volcanic spine and inherited Form IV locomotion |

Forms I–IV and VI have nearby comparison instances. Forms I–III and VI are lava-only;
existing mature Ice, Sand and Plant previews remain available as Form IV.
Unsupported forms throw rather than silently selecting another morphology.

Form V is the awkward transitional form: unchanged mature support limbs,
a sparse asymmetric torso, one upper arm and an offset head. Form VI completes
that anatomy at the same height, with two lean Form-V-style arms, a centered
head and a balanced, open torso. Form VII is the existing massive Apex.
Select these with `createRockBattleBro({ variant: 'lava', form: 5 })`,
`form: 6`, or `form: 7`. The comparison previews include all three stages.
Apex's lower assembly is the complete headless Form IV, preserving its
proportions, asymmetric stones and shoulder–elbow–hand construction. Named
head/core/spine, upper-arm and support-leg anchors are available for later
animation work. The lower assembly runs the existing Form IV hand-walking controller; the
upper torso follows its weight shifts with breathing, upper-arm idle motion,
blinking, loose rocks and eight irregular orbiting fragments. Dedicated Apex
combat animation and further gait polishing are deferred.

### Scenery smashing

Roaming creatures occasionally smash adjacent houses, trees, rocks, fences,
bushes, and flowers. Repeated failed movement searches trigger a strike when
an eligible obstacle is available; each creature then waits 25–50 seconds
before another strike. Specters and monster Forms IV–VII use their arms,
monster Forms I–III headbutt, and long necks rear up and stomp.

Targets shake and compress before impact, then release dust and leave a low,
walkable broken foundation with scattered rubble. Rubble survives world
save/load and disappears when the spot is rebuilt or repainted. Training
facilities, connected multi-cell houses, and cells with extra objects are
excluded. This is local scenery animation; rampage and need-driven behavior
are deferred.

### Terrain smash / consume

`window.battleBroTerrainActions` exposes the local visual-world action for registered
BattleBro roots (all seven forms):

```js
const actions = window.battleBroTerrainActions;
const target = actions.selectTarget(root); // nearby, unoccupied raised cell, or null
const result = actions.consumeTerrain(root, target); // { ok, action } or { ok: false, reason }
// actions.validate(root, { x, z }); actions.cancel(root);
```

Targets use grid coordinates. Omitting the target selects a nearby valid cell.
The actor must be idle. Stone/rock, sand, lava, and grass/dirt/plant terrain share
one action; object-bearing cells are excluded. Reach is capped at 1.65 world
units horizontally and 0.65 vertically, with obstruction and contact checks.

The existing terrain representation uses **level 1 as permanent ground** (zero
rise), including the legacy `floors` fallback. At impact, `setCell` decrements
`terrainFloors` exactly once and refreshes the target and adjacent terrain faces.
Height queries immediately read the updated world data. The target is locked
through absorption; other `setCell` mutations and movement plans cannot enter
that reservation. Cancellation before impact preserves terrain; cancellation
after impact retains the completed decrement. Bulk world replacement is checked
again at impact. No reserves, XP, or persistent character rocks are awarded.

Effects reuse at most four batches of twelve fragments, with no physics engine
or additional animation loop. `node tools/terrain-consume.test.js` exercises all
seven forms, four materials, higher/lower neighbors, repeated/base rejection,
impact timing, live heights, invalid inputs, and interruption cleanup.

### Editing Form VI and Apex rocks

In `index.html`, edit `createAdvancedLavaBattleBro()` for Form VI and
`createApexLavaBattleBro()` for Form VII. Both construct their final upper-body
layout directly. They reuse Form IV's support base; VI does not build or clone
Form V. Left and right upper arms have separate construction blocks.

Their local `stone` helper accepts:

```js
stone(parent, [width, height, depth], 'rockName', [x, y, z],
  material, [rotationX, rotationY, rotationZ], bevel, side);
```

Positions are relative to the named parent; rotations are in radians. Rotation,
bevel, and side are optional. Edit the arrays on the rock's creation line to
change its resting shape and placement. The helper registers that placement as
its floating animation anchor. There is no later loosening or reshaping pass.
Existing `greater…`/`advancedRight…` node names in VI are retained for compatibility.

### Material variants and character preview

All four materials support Forms I–VII using the same edited form geometry,
contact rig, expressions, loose-rock field, walking, upper-arm gestures, and
terrain consume action:

```js
createRockBattleBro({ variant: 'sand', form: 6 });
// variant: 'lava' | 'sand' | 'plant' | 'ice'; form: 1 through 7
```

The form builders accept a material variant and retain one source for rock
placement. Sand adds strata/deposits, plant adds moss/leaves/vines, and ice adds
frost/shards. These bounded decorations follow the existing floating stones.

The **Character preview** controls select a material and form, with **Focus** to
frame the selected character. Normal startup shows one character. Switching
replaces it and cleans up its movement/action/orbit state. The console equivalent
is `battleBroCharacterPreview.select('ice', 7)`; the selected root is available as
`battleBroCharacterPreview.root`. NFT type and level mappings are intentionally
not configured at this stage.

`node tools/character-variants.test.js` checks all 28 combinations and preview
replacement. Terrain consume tests also cover each material's seven forms.

### Frontend excavation

Open User Stats → Excavation to walk with the geological scanner. WASD moves
and mouse look sweeps. The scanner's meter and pulse strengthen near a buried
gem. Q switches between scanner and axe; 1/2 select them directly. With the axe,
click once to swing, including into empty air or at unbreakable terrain. The
metal-handled plasma axe raises its blade above the grip and chops downward.
A digital sound indicates no terrain broke; a knock accompanies a successful
hit. Valid impacts remove one actual terrain layer through `setCell`, following
the toolbar's terrain erase behavior. You can
excavate any clear, removable cell, even without a scanner signal. E collects an
uncovered gem after its reveal. Escape or Exit excavation returns to normal play.

Removed terrain stays removed and follows the existing world save/render path.
The axe stops at the base layer and protects occupied cells, structures, the
Training Facility, water, lava, paths and non-playable borders. Switching tools,
leaving the mode or losing the target before impact cancels a pending hit.

`EXCAVATION_GEMS` in `index.html` defines colors, labels and probability weights.
`EXCAVATION_TUNING` controls scan/seed radius, seeding cadence, axe reach and swing
and reveal timing. One buried find is seeded near the explorer at a time, only
inside an existing removable layer. Digging elsewhere does not award that gem.
If there is no raised terrain nearby, the scanner directs the player to explore.
Gems are frontend session inventory shown in User Stats, with no onchain effects.
`node tools/excavation.test.js` covers free digging, base protection, seeding,
impact timing, world changes, gem collection and cancellation.

### Plasma fence lines

Select Plasma Fence, press a starting cell, and drag to preview a straight run.
The dominant grid axis determines X/Z orientation; release to build the run.
A click places one centered piece. R or Left/Right rotates single-piece
orientation. Right-drag or Space-drag still pans; two-finger gestures cancel the
pending run and use the existing pinch controls. Escape cancels placement.

The preview is cyan for a valid, affordable run and red otherwise. Invalid or
unaffordable runs place nothing. Existing costs, level caps, facility protection,
terrain locks and fence coexistence/intersections are retained. Legacy edge
fences remain supported in saved worlds. `node tools/fence-line.test.js` covers
axis selection, pointer interactions, previews, accounting and validation.
