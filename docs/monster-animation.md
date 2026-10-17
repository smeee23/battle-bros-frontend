# Shared Monster animation

`assets/monster-animation.js` owns the actual Monster balance, head, secondary-head,
advanced idle and turn-anticipation equations extracted from the home controller.
Its `create` method returns the shared support controller from
`assets/juggernaut-animation.js`. It does not implement another gait, phase clock,
physics action or environment-specific pose path.

`ensureMonsterAnimation` binds one controller per mover. Home movers and endless
residents use the same prepare/commit lifecycle. A cube-released character uses
its environment's existing registration path. There is no automatic follower;
deployed Monsters roam under the resident navigation adapter.

## Reuse and ownership

- The common support controller owns lower-body loading, walking/running phases,
  planted turns, support IK, contact flags, physical-motion measurement and the
  prepare/commit/carry/reset/interrupt lifecycle. It uses `locomotionRig` where
  available, not the visible form number to select a juvenile rig. Every Monster
  form has the mature inherited support assembly, including scaled Forms I–IV.
- The movement adapter owns physical root position/yaw, route selection, scenery
  interaction and terrain queries. Endless Monsters now use the already-existing
  Juggernaut navigation adapter and shared terrain validation. Their simplified
  resident yaw, alternate idle and separate support-update branches are removed.
- At commit, lower support IK runs first; the common lower head compensation is
  retained. Monster then applies exactly one family layer: Greater balance for
  Forms I–V, Advanced for VI, Apex for VII. Upper-body turn anticipation is applied
  over that base pose. Upper-arm inertia/gestures, loose-rock motion, blink and
  expression layers run once in their original home order.
- `tickAdvancedTurn`, `tickMonsterSecondHead`, `tickGreaterBalance`,
  `tickAdvancedIdle` and `tickApexIdle` now delegate to the extracted equations.
  Existing arena combat integration retains its original ownership and call order.
- Form VII's Apex layer explicitly clears upper torso yaw in idle. This prevents
  a cancelled planted turn from leaving a chest heading behind. Reset clears turn
  anticipation and location-dependent arm inertia, retaining the authored pose
  bases and the ability to schedule subsequent gestures.
- Jump preparation, squat/extension, ballistic movement and impact-sensitive
  landing remain exclusively owned by `battlebro-jump.js`, using the same shared
  support IK. Locomotion is suspended during the action and resumes after it.
  No jump constants or navigation jump scheduling are changed.

Capture unregisters the previous mover. Release restores the existing authored
pose and creates fresh anchors, terrain contacts, arm history and controller only
after emergence reaches full scale. The Monster controller is never also bound as
a second Juggernaut controller on the same mover.

## Validation

`tools/fixtures/monster-home-reference.json` records pre-migration home poses for
all seven forms in idle, walk, run and turn, including lower supports, upper arms,
heads, secondary heads and the Apex weapon mount. The replay must match these
poses; do not regenerate the reference to mask an unintended change.

`tools/monster-animation.test.js` compares production home, resident and cube
registration/update paths under equivalent inputs. It checks identical primary
poses, one family layer per frame, persistent planted supports, run flight/landing
contacts, blocked phases, moving terrain, reset, Form VII idle selection, shared
jumps and return to movement. Existing transport and terrain tests exercise
repeated capture/release and all forms on real generated uneven terrain, including
the previously stuck entry location. Juggernaut's original reference tests protect
the unchanged shared gait equations.

Manual visual review remains necessary. Compare the same form and material in
home and endless worlds, allowing for their different navigation decisions. Check
slow and fast motion, planted turns, additional arm gestures, both heads, and
Form VII's weapon spin. On uneven terrain, observe the supports while the body
pulls forward and while turning. Capture/release repeatedly, switch environments
while stored, and check that the first idle/step and the first jump after release
look natural. Browser automation is not used.

Existing endless navigation requests walking and does not autonomously schedule
running or jumping. Those animation capabilities are shared and tested with the
same production gait/action functions; this migration does not add new navigation
behaviors.
