# Terrain traversal diagnostics

In the browser console, call `battleBroTraversalDebug.enable(7)` to inspect the
first active Lava Form VII. Use a different form number (1–7) as needed. The
next wandering decision draws the overlay; `battleBroTraversalDebug.disable()`
removes it. `battleBroTraversalDebug.inspect()` returns the current route
candidates and sampled contact points for inspection without console spam.

- Red points: rejected contacts/destinations.
- Amber points: valid landing candidates (the subsequent swing can still fail).
- Green points/outlines: selected contacts and their full clearance footprints.
- Cyan points: traversable destinations; green line: selected travel direction.
- Panel: recovery state, stationary duration, failed searches, and each route's
  grade, rejection phase and reason. Details update on each planning decision.

The contact trace is capped at 256 samples. Markers, traces and overlay are opt-in
and use the existing scene/render loop. Disable before assessing normal visuals.

## Diagnosis and changes

A controlled baseline of four cardinal routes across flat-height transitions,
diagonal terraces, a high wall, a pocket, and checkerboard terrain reproduced
turn-contact failures on Forms IV/VI/VII even beside a one-level terrace. Straight
steps across that terrace worked. The old contact search clamped every alternative
to one cell, and rejected an entire move when the nearest landing's swing failed.
The full-radius turn envelope also included terrain outside the actual sweep.
There was no separate body-collision rejection or mid-animation deadlock in those
reproductions. Destination occupancy remains an independent restriction.

The shared evaluator now returns IDEAL, ADJUSTABLE, CLIMBABLE, or BLOCKED with a
phase/reason. The preferred search fits fully supported contacts across adjacent equal-height
cells. If it fails, the mobility fallback perches the contact on the highest
block under its footprint and lifts over uneven terrain. Partial support and
occasional support-rock overlap are permitted rather than freezing the actor. It tries up to
16 nearby candidates, and turns can retry one wider stance. Actual oriented
support bounds prevent the two feet from being placed on top of each other.
Swing clearance uses twelve conservatively padded segments on difficult paths,
with lift/travel/lower timing. Preferred landing limits remain one level for I/II, two for III, and three for
IV–VII. The clamber fallback permits three levels for I/II and four for III–VII.
After eight seconds of immobility and repeated failures, all forms can attempt
an exaggerated climb across the full normal terrain height range. This
intentionally prioritizes mobility over anatomical precision. IV–VII share the same support geometry.
Intervening obstacles may use a modest extra lift independently of landing reach.

Eight local directions are scored by turn angle, grade and adjustment. The
previous position and recently rejected targets carry temporary penalties.
After at least two failed full searches and three seconds without 0.06 units of
horizontal progress, recovery may try a checked rearward/lateral step. It favors
the previous safe cell, validates a substantially different exit heading using
the predicted support stance, and revalidates that exit after retreating. A
10-second cooldown prevents repeated recovery attempts; normal safe routes can
still be selected during cooldown. Fully enclosed actors wait safely.

This remains a local procedural planner, not global pathfinding or full-body
mesh collision. It does not guarantee escape through a multi-cell maze whose
exit cannot be found by its bounded retreat-and-next-step search.

Run `node tools/terrain-traversal.test.js` for focused real-rig tests across all
seven forms, including sampled swing clearance, actual support positions,
terraces, passages, pockets, recovery timing, occupancy and failure expiry.

`node tools/terrain-endurance.test.js` runs all seven forms together through
five simulated minutes of fragmented terrain and rejects sustained stalls.
This is simulation coverage, not a guarantee for every generated scene.
