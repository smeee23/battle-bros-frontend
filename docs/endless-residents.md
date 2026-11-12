# Endless resident streaming

Resident placement is planned while each ground island is built, using its cached
terrain cells. Each island publishes at most two safe positions on flat 5×5 patches;
sky islands, water/lava, occupied cells and tall terrain are excluded. These are
placement records, not allocated character rigs. Evicting an island removes its
records too.

The resident update reads those records on the existing render loop. It creates
at most one rig per frame and retains the two-NPC population cap. The initial two
residents can therefore be ready in the first two frames rather than waiting for
an 8,192-cell discovery scan and the old spawn/retry timers.

New islands can receive their residents immediately. Once an island is already in
view, empty population slots are replenished only beyond the fog range: candidate
positions must be at least 56 units away (fog ends at 46) and no farther than 68.
A conservative camera-depth check also protects oblique views, since fog uses
view depth rather than radial distance. This avoids placing a new BRO on an island the player has already been watching.
A full population can leave some islands empty; the cap does not guarantee a BRO
on every island. Existing residents still persist until 70 units away or their
footing becomes invalid, so looking away and back reuses the same rig.

Placement selection does not scan terrain cells every frame. It revalidates at
most eight selected footprints before a rig is created. The existing character
factories, deterministic appearance selection, shared native movement controllers,
island carry and practice encounter behavior remain in use.
