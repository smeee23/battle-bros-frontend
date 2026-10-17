# Juggernaut animation ownership

`assets/juggernaut-animation.js` contains the original home pose equations,
juvenile phase sequencing, mature phase sequencing, planted turns, support
solvers, head coordination and secondary-layer ordering. There is one bound
controller per mover. `ensureJuggernautAnimation` supplies it to home movers,
endless residents and cube-released Juggernauts. Endless Juggernauts return before
the generic resident pose branches. Monster still uses its original controller
and ordering through delegates to the extracted support utilities; Specter is
unchanged. Arena-only poses are outside this migration.

## Boundaries

- Navigation owns route selection, clearance, terrain plans, scenery effects,
  run eligibility and physical root movement. The home adapter retains existing
  navigation. The resident adapter retains bounded flat-island roaming and checks
  support footprints through the endless terrain provider. It does not query home
  cells or join the home mover set.
- `prepare(input, dt, time)` advances the existing contact/pose sequence and returns
  proposed physical position/yaw. It restores the physical root before returning.
  The adapter applies the proposal, then calls `commit(resolved, time, dt)`.
- `commit` solves supports against the accepted root and applies head, expression
  and secondary layers once. It measures velocity and yaw rate from actual motion.
  Contact phases come from the gait/turn records, not inferred movement labels.
  Mature running flight has neither support planted and reports airborne.
- Adapters validate whole frame proposals; `accepted: 0` rolls back contact/phase
  preparation. Fractional acceptance is not an adapter contract in this migration.
  Home gameplay callbacks remain host-owned; they must not be used as speculative
  collision probes. Check route validity before preparation.
- `carry` translates contacts, turn endpoints, trajectory endpoints and motion
  history with moving terrain. Island transport is excluded from walking velocity.
- `reset` discards the previous sequence and replants at the current location;
  `interrupt` only resets motion history and does not overwrite exclusive poses.
- Jump physics and poses remain in the existing `battlebro-jump.js` action, using
  the same extracted support solver. It owns the pose exclusively while active.
  Gravity, velocity, impact-dependent compression and landing recovery are unchanged.
  Resident navigation still does not autonomously schedule jumps.
- Cube emergence owns scale. After full-size emergence, existing transport binding
  restores authored transforms and creates fresh world-specific movement/contact
  state. Capture drops the old mover; there is no controller registered in both worlds.

Forms I–III retain their four/three/two-pull juvenile sequences. Forms IV–VII
retain mature walking/running, with their existing scale and form tuning. Navigation
can choose different movement across environments; identical supplied motion and
contact sequences use identical pose equations.

## Regression checks

`tools/fixtures/juggernaut-home-reference.json` was captured before extraction.
`tools/juggernaut-reference-capture.js` replays idle, walking, turning and mature
running against it. Do not regenerate the reference merely to accept a failure.

`tools/juggernaut-animation.test.js` checks those poses, real home/resident turning
for seven forms, root ownership, rejected phases, drift and relocation. Existing
rock, resident, jump and transport tests cover support stability, all forms,
terrain transitions, repeated cube lifecycles and Monster compatibility.

## Visual review

Run `npm run dev`, then open the local app with `?juggernautReview=1`.
The development-only review uses the existing renderer and animation loop. Select
Forms I–VII and idle/walk/run/turn/jump/blocked/moving-support scenarios. Pause,
step and inspect front, side, overhead and three-quarter views. It presents three
instances under equivalent inputs; it deliberately bypasses navigation rather
than claiming three independently simulated worlds. Forms I–III keep their
existing walking gait when run is selected.

Check planted supports during reaching and body rotation, coordinated body/limb
loading, moderate preparation compression, launch extension, airborne relaxation
and complete landing recovery. Check head/neck motion and secondary attachments.

Then remove the query and test actual home and endless contexts: turn and move on
flat ground, interrupt a route with an obstacle, release near an island edge, and
repeat capture/release in both worlds including travel while stored. Compare the
same form and material; different navigation pauses are expected. Verify one
visible Bro, fresh contacts at release, no frozen pose and normal resumed movement.

Automated numeric and integration tests do not replace this visual sign-off.
