# Longneck animation ownership and review

`assets/longneck-animation.js` is the authoritative pose/contact implementation for all seven Longneck forms. It is loaded by the browser and required directly by Node tests. It has no context selector and no renderer, navigation, collision, gravity, terrain mutation, or timer loop.

## Integration

- Home: `registerMinotaurMover` binds once; `tickMinotaurMovers` retains wandering, safe rearing eligibility, scenery actions, and recovery. It resolves `prepare` and invokes `commit`.
- Residents: `tickExplorationResidentMotion` retains local destination selection and terrain restrictions. Its Longneck branch uses `prepareTravel` / `commit`, bypassing generic resident turns and arena idle poses.
- Transport deployment: the cube carries the selected instance between worlds. Home release registers the original home movement path; endless release uses the existing resident movement path. Both use this Longneck module. Capture pauses movement; release resets local joints and rebuilds contacts at full size before navigation resumes. Automatic following and recovery teleports remain removed.
- Home jumps: `tickHomeBattleBroJump` schedules a safe idle jump through `assets/battlebro-jump.js`; that action delegates Longneck poses back to this module.
- Thin compatibility delegates for home contact callers contain no pose equations. The original non-Longneck minotaur has a separate legacy path; it is not used by any Longneck.
- Juggernaut, Monster and Specter retain their existing animation paths.

## Two-stage contract

`prepare` proposes position, heading and progress; it does not move the physical root. `prepareTravel` adds contact-sized stride/turn sequencing for continuous destination inputs. It accepts speed, run intent, support identity/translation, destination height and an optional ground-height sampler.

The movement owner validates and applies the proposal. `commit` receives the accepted fraction, resolved speed, grounded state and optional jump state/configuration. It reconciles gait phase and writes visual transforms, never physical root position or rotation. Blocked movement uses accepted=0. A turn can be accepted without horizontal displacement.

World contacts persist through each stride. `carry` translates contacts with their supporting island. `reset` releases obsolete contacts after recovery or a support discontinuity. `interrupt` invalidates contacts without overwriting a strike's active pose.

Home root bob/bounce is now a visual rig offset, divided by root scale to preserve the original world-space motion for every form. Root elevation remains with movement/physics.

## Transform ownership

| Owner | Transforms |
| --- | --- |
| Movement/physics | Physical root position/yaw, support transport, ballistic trajectory |
| Shared controller | Gait/contact phase; four hip/knee poses; visual rig height; animal-body squash/pitch; rearing pivot; torso; locomotion arms; head compensation, gaze, jaw and outer-eye blink |
| Existing action system | Strike poses while its exclusive action branch runs; throw-specific layers retain their existing final secondary-update ordering |
| Expression system | Inner face/expression slots |
| Secondary update | Orbit/loose-rock/telekinetic effects, once after posing |

Do not add gait, turn easing, head, blink or jump-pose equations to a context adapter. Add those changes to the module and run shared replay plus real-context integration tests. Keep action arbitration explicit rather than calling a locomotion commit after an exclusive strike pose.

## Automated checks

Run:

```
node tools/longneck-animation.test.js
node tools/restored-characters.test.js
node tools/exploration-residents.test.js
node tools/transport-cube.test.js
node tools/battlebro-jump.test.js
node tools/scenery-smash.test.js
npm test
npm run build
```

`tools/fixtures/longneck-home-reference.json` contains numeric world-space pose captures taken from the pre-migration home implementation. It covers seven forms, seven states and three points per state. The capture records torso, body, head and opposite front/rear leg position, quaternion and scale. `longneck-reference-capture.js` samples the current production home controller for comparison; it does not retain a second animation implementation. Do not regenerate reference data merely to make a failing test pass.

Additional tests cover root ownership, equivalent inputs, rejected/partially accepted movement, persistent contacts, moving support, jump direction, full-axis cleanup, blink recovery and actual resident movement and transport deployment. Existing scenery tests cover rearing, planted gallop, strikes and trampling.

## Visual procedure

Start the normal local server (`npm run dev`) and open:

`http://127.0.0.1:3000/?longneckReview=1`

The review script lives under `tools/` and is only requested on localhost with that query. It uses the existing renderer and animation loop. It is not included in the production build.

1. Select Forms I–VII in turn. Use three-quarter, side, front and above views.
2. Play idle, walk, gallop, turn, step up/down, standing/running jump, blocked movement and moving-support scenarios.
3. Pause and frame-step at foot plants, takeoff, apex and landing. Compare body/head coordination, lateral leg spacing and residual angles after landing.
4. The three lanes deliberately receive identical inputs and bypass navigation. They validate the shared pose response, not the three navigation policies. Their animation should match exactly.
5. Reload without the query for real-context checks. Observe the same form/skin at home and as a resident. At home, wait for an idle jump on clear, flat ground (initial eligibility after roughly 22–32 seconds).
6. Enter the other world, select Transport cube from Q (or press 2), and click to throw at a broad clear landing area. Observe the cube opening and the character emerging. Observe local resident roaming without player following. Throw again to recall; click separately to redeploy. Repeat at home and verify normal home movement resumes.
7. Throw toward a wall, the player’s feet, or empty space: the cube returns without creating a character. Check all seven forms and travel both ways while the Bro is stored.

The review jump trajectory is a controlled demonstration using the application's gravity and jump constants. Production home jumps use the reusable jump action. No following navigation remains.
