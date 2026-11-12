# Shared frontend combat

`assets/character-battle-actions.js` owns the combat configuration and session
for both Arena and Endless practice. Cameras and scene-specific native animation
remain in their existing adapters. No blockchain, yield, territory, progression,
rewards or wallet transactions are involved. Health is local to a battle.

## Timing and visuals

The old controller locked BOTH actors while any attack, rock throw or hit reaction
was active. Normal throws waited through a .5 s notice, 1.45–2.65 s orbital wind-up,
tangent alignment, flight, recall, coasting and settling. Form I borrowed a limb
until 2.27 s and finished at 2.65 s. Hit reactions lasted 2.35–3 s. Those locks,
not just the plane-attack cooldown, caused the long interval between combat shots.

Combat now has a short, independent throwing gesture, a per-fighter cooldown and
a bounded projectile pool. It reuses `applyTelekineticBody` for the existing
family-specific arm, torso and neck pose. The original long orbital throws used
by other world activities retain their timings. Combat copies existing stone
geometry/materials, samples the stone's current world position at launch, and
never detaches real support limbs. Incoming hits briefly stagger the BRO but do
not gate its next attack. Gestures cannot overlap on one BRO; flights can overlap
and both fighters can attack concurrently.

The default configuration at the top of the shared controller is:

| Setting | Default |
| --- | --- |
| Health | 100 each |
| Normal damage | 8 per successful hit |
| Normal wind-up / gesture / cooldown | .08 / .26 / .32 seconds |
| Berserker damage | 32 |
| Berserker wind-up / gesture / cooldown | .14 / .42 / .60 seconds |
| Energy capacity / normal-hit gain | 100 / 20 |
| Hit reaction duration | .32 seconds |
| Opponent initial delay / cadence | .70 / .95 seconds |
| Projectile speed | 32 world units/second |
| Flight duration limits | .16–.70 seconds |
| Pool bound / maximum range | 12 / 40 world units |

Pass `config` to `createBattleBroBattleActions` to override these values. Both
production adapters use the same defaults. `start(actors, {opponentEnabled:true})`
starts a fresh session. Manual animation-test sessions can disable the opponent.
Arena starts AI only when entered; practice starts it after Yes. Exit, replacement,
removal, restart and battle completion cancel active visuals/projectiles.

## Damage, energy and completion

Each accepted attack reserves one pooled slot, receives a unique attack ID and
launches exactly once after its wind-up. Homing flight uses a swept segment
against a .3-unit sphere around the opponent's current body/head target. Only
contact applies damage and triggers the existing hit reaction. The slot is then
released, so subsequent frames cannot damage twice. A discontinuous target move
misses; expiry/removal/cancellation causes no damage or energy gain.

A normal hit grants 20 energy to its attacker, capped at 100. Accepted Berserker
execution consumes 100 immediately and deals 32 on contact. A missed special
still spends its charge. Special hits do not recharge the meter. The temporary
special is a larger stone with an orange wireframe glow; normal shots share the
original rock materials. Shield does nothing. Arena's Test hit previews the
reaction only and deliberately causes no damage.

Health clamps at zero. The first lethal impact sets the winner, disables attacks
and AI, and clears all remaining shots/gestures/reactions. No subsequent damage
is possible. The result remains visible until exit or Arena's New battle. The
opponent currently fires normal attacks only and does not make strategic choices.

## Performance and limits

There is no extra global loop or timer. The existing scene loop advances the
shared clock once per pair, then poses each reaction. Projectile slots and scratch
vectors are reused. Projectiles borrow cached geometry/materials; only the glow
material belongs to the combat controller. `dispose()` releases that material.
The pool stays bounded across restarts; overflow rejects a shot without spending
energy. The pose deferral fix is preserved across all families/forms.

The balance is provisional. Homing shots currently have no terrain/prop occlusion
or projectile-vs-projectile collision. Opponent strategy, charge moves for AI,
sound/haptics and a more elaborate special animation are follow-up work. No live
browser visual/performance profiling is included in the automated tests.
