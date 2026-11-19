# Gameplay messages

`assets/game-messages.js` mounts the existing transport-cube HUD (`excavation-hud`,
`fp-equipped-tool-label`, `excavation-status`). The box retains its border,
background, rounded corners, shadow, width, font and first-person placement.
Building mode raises it above the toolbar and the independent fence-orientation
buttons. It accepts no pointer input and is a single atomic, polite live region.
It is hidden when no relevant context or notification exists.

Use `globalThis.battleBrosMessages`:

```js
// Repeated calls with unchanged values perform no DOM writes.
messages.context('cube', 'Aim at clear ground', {
  title: 'BRO teleport cube equipped', priority: 30
});
messages.notify('Complete your BRO’s open Need before claiming.', {
  source: 'territory-claim', category: 'error'
});
messages.context('cube', 'Recall BattleBro', {
  title: 'BRO teleport cube equipped', priority: 30
});
// Clear irrelevant instructions; the latest remaining context will be selected.
messages.context('cube', '');
```

Contexts are stored independently per source, including while hidden under a
notification. The highest priority live context wins; changed contexts break ties.
Tools take priority over nearby territory labels. Notifications always override
context. Categories are information (`info`, 4 seconds), warning (6 seconds), and
error (8 seconds). Duration is measured in seconds actually displayed, using the
existing game loop. Higher categories interrupt lower categories, which retain
remaining reading time. Equal-priority warnings/errors wait their turn; repeated
identical notices do not restart the duration. Informational progress from the
same source replaces earlier informational progress. Pending notices coalesce by
source and the queue holds at most five entries, retaining higher priorities
first. Every notification and context uses text content, never HTML.

The existing `animate` loop calls `setMode`, `setVisible` and `tick`. Mode changes
clear contextual messages and mode-scoped notifications. Optional `scope` can
name a mode to reject stale asynchronous results, or `global` for cross-world
results such as confirmed settlements and world saves. Training, practice and
encounter dialogs suppress the shared box; the tools menu also pauses its
reading time. No timer, extra render loop, DOM observer or dependency is added.

## Audit and migration

| Previous display | Result |
| --- | --- |
| Cube and mining/raising HUD | Existing box reused; phase/aim instructions are live context, failures and collected/broken/raised feedback are temporary notices. |
| Separate territory-status pill and timed claim error | Removed; proximity labels are context, claim restrictions are error notifications in the shared box. |
| Floating territory-settlement button | Replaced by a ten-second shared notice; existing acknowledgment behavior retained. |
| Fence hint containing orientation buttons | Passive instructions moved to the shared box; orientation buttons remain interactive, above the toolbar. |
| Flight control hint | Moved to shared context, removed on flight exit. |
| World-arrival failure | Shared error notice, including failures that leave the player at Home. |
| Blocking import and auto-placement browser alerts | Shared errors with the same meanings. |
| World load/save feedback and player-action errors | Shared notices. Standalone player UI retains inline fallback when no game message component is mounted. Routine local-draft autosaves do not generate repetitive popups. |

## Intentionally retained

- Loading cover, Retry/Continue recovery, interactive confirmation dialogs,
  care/hatch/training/stamp editors, character-preview and XR panels, wallet
  prompts, practice menus and results: these
  contain controls, validation or transaction state needed to complete an action.
- Form-specific messages in those editors (including open-Need restrictions,
  transaction progress, weight validation, appearance save feedback), history and
  lookup errors: they remain beside the affected controls and are not mirrored
  into competing gameplay notices.
- Persistent selected-BRO defense status, world-save configuration, selected
  building details, inventory, metrics and tooltips: these describe state rather
  than a temporary event.
- Disabled legacy developer/generator/API/inspection panels and their internal
  progress/status fields. They are outside current gameplay flows.
- Separate landing/territory pages are outside the three game modes in this
  refactor.

These panel and page displays retain their original styles intentionally. All
migrated passive gameplay messages use the one shared box. Browser visual review
is still useful for unusual viewport sizes; the automated checks exercise the
controller, real territory adapter, production world loop, and player-save UI.
