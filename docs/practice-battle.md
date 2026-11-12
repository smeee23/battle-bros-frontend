# Endless practice battles

Release your transported BRO near an NPC and choose **Yes** from the existing
encounter. The question appears after about 0.8 seconds while the BROs turn.
Choosing **Yes** immediately faces both BROs toward each other, clears their
temporary turn state, and enters combat without waiting for the turns to finish.
The camera moves above and to the right of your BRO, scaling its height and
side clearance to the rig's height, width and forward reach. Framing also accounts
for the opponent and viewport, with an adaptive field of view to keep rocks and
the opposing BRO readable when large rigs need more camera distance. Click the screen (or press
Space/Enter) to throw a quick rock. Health bars track beside each BRO. The compact
**Berserker** button fills as normal hits land and becomes clickable when charged;
**Shield** uses the same style and remains an inert placeholder. The opponent attacks on a configurable cadence. A lethal
hit stops combat and shows **You win!** or **You lose!**. The camera smoothly pivots
to your BRO's face, with a big smile for a win or a sad expression for a loss.
After three seconds, practice closes automatically and opens the cube beside
your BRO, shrinks the BRO inside, and returns the cube to your hand.
**Escape** ends the result early and starts the same return. The same BRO stays stored for its next
deployment. During an unfinished fight, **Escape** restores
exploration, the camera, and the suspended BRO routes. Health and energy reset
for each practice encounter. Exiting restores focus to the game canvas and
requests mouse capture, including the automatic three-second exit. If capture
is pending or denied, canvas mouse-look remains available and the next ordinary
movement key retries capture without requiring an extra click. These fights have
no onchain consequences.

The shared combat defaults are `projectileSpeedMultiplier: .85` and
`projectileScale: 1.2` for both BROs in Practice and Arena, including automatic
NPC attacks and normal/Berserker rocks. This slows flight by 15% and increases
rock size by 20% without changing attack cadence, damage or energy.
All normal projectiles use the Form I Juggernaut reference size: `.42` world units
before the shared `1.2` scale, or `.504` units across. Source geometry is normalized
so decorative orbit pebbles and larger body stones produce the same projectile
size for every family, form and side in both environments. Materials, rock shape
and launch position remain character-specific; supporting body stones stay attached.
Berserker retains its existing 1.8× visual size multiplier. There are no
opponent-only size overrides.

The Arena uses the same health, energy, attack timing, opponent cadence, projectiles,
hit/recovery and completion implementation. Its **New battle** button restarts
combat; its appearance controls and animation-only **Test hit** remain available.
See [shared combat](combat.md) for tuning and the reason the old attacks were slow.

`assets/practice-battle.js` only manages the world camera/session and delegates
to `assets/character-battle-actions.js`. The Arena delegates to that same controller.
Both continue using their original native family animation systems and the
single render loop. The shoulder camera scales to the rigs and viewport and has
a terrain-height guard, but does not provide full obstacle occlusion avoidance.

Practice retains the clean pose pipeline: restore last frame's combat effects,
restore the saved upright combat heading, then
evaluate native poses with attachments deferred, capture clean baselines, apply
ready stance, advance attachments and the shared short throwing gesture once,
then advance projectiles and apply hit reactions. The gesture reuses the existing
family-specific telekinetic body/arm/neck posing, without the long orbit/recall
state machine. All families use this ordering; attack/hit offsets do not enter
the captured baseline. Deferral clears on exit/cancellation. Island carry stays
active while normal walking/jumping and exploration tools are suspended.

Practice stores heading separately from temporary root hit tilts. Restoring a
quaternion can encode headings beyond 90 degrees as equivalent Euler X/Z
half-turns; native turn controllers must receive a clean yaw before evaluating
facing. Heading is sampled again after native posing and before combat effects,
so intended turns and island movement still work. The shared hit animation and
Arena pipeline are unchanged.

Recall/removal cancels the shared combat session, detaches pooled projectiles,
clears gesture/reaction layers, and restores the camera. Actual support limbs
stay attached even in Form I: shots reuse rock geometry rather than borrowing
and recalling a supporting limb. No damage, energy or attack timer persists
outside the active encounter.

`npm run combat:test` covers damage, Berserker, cadence, completion, pool bounds,
all 112 family/form/material attacker combinations, real encounter input and
restoration, and joint-transform parity across all 28 family/forms with normal
and Berserker attacks. The parity fixture supplies equivalent baseline poses
and idle-gaze inputs to both scene pipelines. The native-controller practice
regression retains real idle behavior, checks bounded neck pitch and clean
baseline captures, and verifies one body/attachment application per frame.
