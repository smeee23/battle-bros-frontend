# Shared Specter animation

`assets/specter-animation.js` contains the actual floating phase equations,
robe response, floating-arm gesture equations and fast-float strokes extracted
from the home implementation. There is one bound controller per mover, selected
by `ensureSpecterAnimation`. Home, endless NPC and cube-release paths all execute
its `prepare` / `commit` methods. Specter does not use the planted-support core.

## Boundary and ownership

Navigation selects a destination, duration, fast-float intent and validated
terrain heights. The shared controller sequences IDLE_HOVER, START_FLOAT, FLOATING
and SETTLING. A stateful progress value drives the actual eased root proposal and
its visual pose together. No adapter invents a separate gesture/gait phase.

`prepare(input, dt, time)` returns root position/yaw without applying them to the
physical root. Terrain clearance comes from the supplied height sampler, using
the same home minimum-hover clearance. The movement adapter applies that proposal.
`commit(resolved, time, dt)` measures actual velocity, acceleration and yaw rate,
then applies the visual layers. Rejected proposals restore phase and primary pose
state; this integration validates whole frame proposals rather than fractions.

The original home order is retained in one place:

1. Base floating/hover posture and turn anticipation.
2. Robe lag, including remaining resolved heading during turns and actual lateral
   displacement along a curved path.
3. Floating-arm drift, movement/turn following and authored gesture sequence.
4. Fast-float strokes with priority over the specific shoulder/elbow/wrist axes
   they own; gesture-driven jaws and other axes retain their original behavior.
5. World expression, facial expression and loose-rock/orbit/throw layers, once.

Compatibility functions `tickFloatingRockArmGestures` and `poseSpecterLocomotion`
are thin delegates to these same equations. Existing arena combat uses its prior
integration; it is not an endless-world animation fallback anymore. Specter's
simplified endless turn, independent hover accumulation, secondary lean and
alternate idle/gesture path have been removed.

`carry` translates movement endpoints and both controller/gesture motion histories
with the supporting island. Island drift does not create false acceleration or
arm strokes. `reset` restores primary authored transforms and clears stale robe,
gesture and movement history without changing the physical root or gameplay data.
`interrupt` only resets history and leaves exclusive action poses alone.

The existing shared jump action retains ownership of Specter's preparation,
takeoff, ascent/descent and landing pose while active. Its actual vertical physics
and impact/contact transitions remain unchanged. Home and endless animation
updates suspend their locomotion commits until that action completes.

Cube capture/release retains the original instance and existing lifecycle. At full
emergence, home registers the home mover; endless registers a resident Specter
mover without joining the home set. Both bind this same controller with fresh
movement and arm histories. Terrain support, placement and collision rules are
unchanged. Endless route planning retains its straight path, normal duration and
local roaming radius; it supplies the full home float/turn/settle sequence. Fast
floating is available through the navigation intent but is not newly scheduled
at random by endless navigation. Automatic jumping is likewise unchanged.

## Verification

`tools/fixtures/specter-home-reference.json` captures all seven pre-extraction home
forms in idle, start/turn, ordinary float, fast float and settling, including robe,
body, head, shoulders, elbows, wrists and jaw joints. The capture replay must match;
do not regenerate this file just to accept a regression.

`tools/specter-animation.test.js` compares production home, resident and cube
registrations/updates under equivalent movement inputs. It verifies one commit
per frame, directional robe lag, fast-float settling, every authored gesture,
actual motion data, rejected phases, physical-root ownership, island transport,
reset and exclusive jumps followed by resumed floating in every context.
Existing terrain tests verify every form on real generated uneven terrain and
full throw/open/recall sequences; transport tests cover repeated home/endless
capture and release and travel while stored. The other three families' pose
reference tests remain applicable and unchanged.

For manual visual review, compare the same form/material at home and in endless
terrain. Watch start-up tilt, the robe's delayed rotation, gesture shoulders and
wrists, and the transition into and out of fast strokes. Observe release, an idle
hover, a turn and travel, settling, a jump/landing where scheduled, then recapture
and release in the other environment. Different navigation pauses and speeds are
expected. Check Forms I–VII, particularly advanced robes, satellite rocks and
Specter III/IV eye clearance. Browser automation is not used.
