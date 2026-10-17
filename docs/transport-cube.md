# Transport cube

In Home World or the endless world, open **Q → Transport cube**, or press **2**. Aim at a broad, clear area several blocks away and click. The cube travels through the air, opens on valid ground, and the selected BattleBro emerges. Its family, form, skin and color selections are preserved.

The cube carries the selected character itself, preserving its identity, appearance and gameplay data. A released character resumes the environment’s existing movement: home roaming and animations at home, or resident roaming in the endless world. Click again with the cube equipped to throw the cube toward the character. The cube opens, draws the character inside, and returns to your hand. The character stays captured until another click throws it to a new location. Switching to another tool leaves the deployment in place. World travel packs the active character into the same cube; a stored character remains stored across travel. Release it with another click in the destination world. Exiting first person at home leaves an active home character roaming; exiting the endless world packs it for travel. Appearance training preserves whether the character was active or stored. Selecting a different preview character replaces the selection as before.

Throws into empty space, obstacles, occupied ground, uneven footing or too close to the player return the cube without deploying. Landing validity is checked again while the cube opens, so walking into the landing area cancels deployment. There is no ammunition cost or onchain/game-state mutation.

## Animation ownership

- `assets/transport-cube.js` owns cube flight, opening, character emergence/recall scale and transport lifecycle. It does not contain character gait, jump or idle poses.
- Home release registers exactly one existing `registerMinotaurMover`, `registerSpecterMover` or `registerLavaMonsterMover`. Endless release uses `tickExplorationResidentMotion`, the same path as existing residents. Longneck continues delegating to `assets/longneck-animation.js`.
- Capture unregisters navigation before scaling; no movement controller runs during emergence. At full size, release restores authored local transforms and creates a fresh mover. Old world anchors, stride/turn records, foot contacts, head/arm inertia and jump state are discarded. Identity and gameplay data remain on the same object.
- Storage detaches the rig and its orbit field without disposing either. No clone, extra render loop or second animation implementation is created.
- `assets/battlebro-jump.js` owns the shared jump action and unchanged low-gravity trajectory. Juggernaut/Monster squats reuse the existing support IK (and juvenile segment posing): feet plant during preparation/contact, extension follows actual launch displacement, and impact speed controls bounded landing compression. Longneck delegates to its authoritative module; Specter retains its existing poses. Endless residents currently do not schedule jumps.
- Home controllers schedule that action while idle on clear flat support. Jump preparation, takeoff, ascent, descent and landing temporarily own the rig; normal home navigation resumes afterward.
- The old follower controller, duplicate follower gaits, player-targeted jump planning and emergency repositioning have been removed. Home and resident navigation remain.

## Validation

```
node tools/transport-cube.test.js
node tools/battlebro-jump.test.js
node tools/longneck-animation.test.js
node tools/excavation.test.js
node tools/portal-travel.test.js
node tools/training-appearance.test.js
npm test
npm run build
```

For a browser check, capture and release repeatedly with each family/form in both worlds, confirm walking/turning/idle resume, capture during a step/turn/jump, travel both ways while stored, switch tools while the character is deployed, move far away, throw into void/walls, walk into an opening cube's landing area, and leave/re-enter the world. At home, watch for a jump after an idle opportunity on clear ground, followed by ordinary locomotion. The cube uses a short throwing arc; character jumps retain the player's low-gravity constants.

Storage is local to the current page/session; it does not add a persistent inventory or change onchain location/ownership. Endless navigation retains the existing residents’ conservative flat-ground movement limits.
