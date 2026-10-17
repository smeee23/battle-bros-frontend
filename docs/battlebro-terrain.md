# BattleBro support and clearance

`assets/battlebro-terrain.js` supplies the common standing and walking rules used
by cube placement and endless-world navigation. It has no animation or rig solver.
Its family/form dimensions describe a simplified support rectangle, body height,
leg clearance and step capability. Root growth scale is included; transport uses
the stored full-size scale, so emergence/recall shrinking cannot change eligibility.

Standing samples the footprint at intervals no larger than 0.3 world units. Every
sample needs supported, obstacle-free terrain on the same island. Heights may
vary by the form's step capability (roughly 0.2–0.6 world units). The root stands
between the lowest and highest support levels. Overhead/body collisions use the
terrain provider's existing collision query. Home facility exclusion remains in
place. Upper decorative rocks and orbiting effects do not enlarge the footprint.

Walking checks the turning footprint and then sweeps the translated footprint at
intervals of at most 0.2 units. It checks intermediate terrain, height differences,
obstacles, island identity and destination character clearance. This prevents a
valid endpoint from allowing travel through an unsupported gap. Placement and
walking use the same support rules; standing safely does not imply every possible
direction is traversable. Physical crowd spacing uses character dimensions rather
than the previous six-cell movement exclusion.

`residentFlatCell` remains a sparse NPC *spawn* filter. It no longer controls
walking destinations or removes residents merely for moving onto uneven terrain.
Resident support checks have a bounded 0.1-second cache; newly planned routes and
cube placement validate immediately. Terrain height is supplied to movement, so
climbing/descending no longer uses a fixed starting elevation.

The existing Juggernaut/Monster support IK and terrain-swing functions resolve
actual limb contacts after placement. Raised support swings use the existing
clearance arc. Longneck receives optional per-foot terrain samples inside its
shared controller; its ordinary home pose references remain unchanged. Specter
retains its existing hover clearance and follows the accepted height transition.
No jump physics, jump animation or autonomous jump scheduling is added or removed.

Validation includes the original stuck entry location on unedited procedural
terrain for all four families; all seven forms of each family released onto an
edited rocky terrace using the real procedural terrain provider; upward/downward
routes; narrow supported platforms; and rejection of obstacles, gaps, large steps,
ceilings and genuine island-edge overhangs. Existing cube lifecycle, home pose,
jump and sky-island tests remain applicable. Browser visual validation is still
required for subjective foot settling and gait appearance; no browser automation
is used.
