# Training facility settings

The facility has three actions: Save appearance, Save weights, and Return outside. Both save actions keep the facility open. Return outside and Escape warn before discarding unsaved changes. Successfully saved appearance changes remain the rollback baseline for subsequent edits. Submitted weight transactions continue to be tracked if the player leaves.

Attack and Defend percentages accept up to two decimals; Counter fills the remainder to 100%. Invalid totals disable Save weights without blocking appearance saves or leaving. Unsaved weight edits exist only during this facility visit. Published stats remain authoritative outside the facility.

Save appearance uses the existing signed backend appearance save. Save weights submits changed **training** weights through the shared transaction service. Defense weights cannot be edited in either training facility. Both training facilities hide the defense section. The normal stats panel shows defense weights only when the connected owner is viewing the opened territory defended by the selected BRO. Home, Endless exploration, unbound development boards and other territories hide the section. Choose initial defense weights in the claim/challenge transaction instead.

Blocked training sections show confirmed weights and explain open Needs, pending challenges, wallet/network or transaction availability restrictions. Save weights is disabled while training changes are blocked. The original contract rule remains intact: holding a territory locks defense changes even between challenges. The contract, its regression tests and documentation were restored; the new facility and terrain remain. No backend changes or local chain reset are needed.

Implementation: `assets/training-weights.js` handles validation and facility UI; `wallet/weights.mjs` binds selected/owned BROs to the transaction service. Weight records persist in existing transaction history for safe tracking across reloads, while unsaved drafts do not persist.

Checks: `node tools/training-weights.test.js`, `node tools/training-appearance.test.js`, and `node --test tools/weights.test.mjs tools/appearance.test.mjs tools/needs-ui.test.mjs tools/transactions.test.mjs`.
