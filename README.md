# BattleBros territory frontend

The Three.js world consumes territory publications; territory.html provides wallet actions. Only territory schemaVersion 4 / projectionVersion 5 is supported.

Run npm test and npm run build. Build only writes dist; it does not publish. Configure BATTLEBROS_DEPLOYMENT_MANIFEST and BATTLEBROS_MANIFEST_URL for an actual deployment. deployment/territory.example.json is illustrative, not a deployed network.

From contracts, npm run interfaces:sync regenerates canonical ABIs, backend copies, frontend selectors, and public schemas. npm run interfaces:check checks all consumers.

## Endless NPC residents

Wild BROs idle and roam locally on their islands. Approaching an NPC does not
trigger a chase, camera lock, catch overlay, or forced regeneration. Encounters
between a deployed Bro and wild residents remain available.

## Wallet connectivity (first pass)

Run `npm ci`, then `npm run dev`. Open the wallet control at the top of the
game's Stats panel, or in the territory dashboard header. The game and dashboard
share one VanillaJS Wagmi Core/Viem service. No application RPC URL, provider key,
login signature, or running blockchain is needed to connect an installed browser
wallet. Browser wallets still use their own configured RPC connection.

The target defaults to chain 31337 on localhost and Ethereum mainnet on hosted
origins. To test connection to your wallet's mainnet network without a local
node, run `BATTLEBROS_WALLET_CHAIN_ID=1 npm run dev`. Sepolia (11155111) and Hoodi
(560048) are also accepted. Local switching needs a running local node if the
wallet checks network availability. No public testnet contracts are deployed by
these commands.

Supported now: EIP-6963 wallet discovery, legacy injected wallets, explicit
connect/disconnect, silent reconnect, account/network changes, network switching,
and recoverable errors. Disconnect is an application/connector disconnect;
extension site permissions may remain. Reconnection metadata is stored under
`battlebros.wallet`; no signatures or keys are stored. If browser storage is
unavailable, the current page uses memory and reconnect across pages is limited.
Connecting does not grant territory-edit authority or change local world data.
WalletConnect/mobile connectors and contract-wallet signatures are deferred.

`npm run wallet:build` creates an approximately 72 KiB ESM bundle at
`build/wallet.js`. Dev startup, tests, and the static build run this automatically.
The Three.js app remains unbundled. The wallet panel does not fetch S3 snapshots,
poll RPCs, or participate in animation frames. Opening it releases pointer lock
and clears held movement keys; click the scene to resume pointer lock.

Optional public settings belong in the deployment public-data config:

```json
{
  "wallet": {
    "chainId": "11155111"
  }
}
```

`BATTLEBROS_WALLET_CHAIN_ID` and `BATTLEBROS_WALLET_RPC_URL` override the wallet
target and optional browser RPC. A browser RPC key is public; use a separate
restricted key from backend credentials. No default hosted RPC is contacted.
Later transaction services can use the configured transport; this pass retains
the existing dashboard's simulation/receipt flow through the selected wallet.
Persistent transaction tracking and typed signing are a subsequent phase.

Existing dashboard writes require an explicit `wallet.deployment` object with
`chainId`, `deploymentId` (Combat address), and `contracts` containing every
address from the trusted deployment. The chain must match `wallet.chainId`.
Publications, including `?manifestUrl=...`, cannot authorize addresses. Without
trusted configuration the dashboard remains readable and writes are rejected.
The local dev server supplies trusted identity from its own successful local E2E
artifacts; that test's chain is stopped afterwards, so transactions additionally
require running the matching chain. Do not treat arbitrary remote snapshots as
trusted deployment configuration.

The driver is the connector boundary: WalletConnect can be added there later
without changing game controls, ownership projections, or renderer code. The
shared `wallet.session()` supplies the selected provider and an account/network
guard for subsequent transaction/signing services. Ordinary reads continue via
the existing indexer/PostgreSQL/S3 publications.

Validation: `npm run wallet:test` uses real Wagmi connectors with simulated
EIP-1193/EIP-6963 providers, including reconnect, disconnect, rejection, account
removal, network switching and changed-session protection. Before live testnet
release, manually exercise two installed extensions, locked/rejected prompts,
navigation between the game/dashboard, and all three worlds while monitoring
frame times. Actual extension dialogs and real-chain transactions are not
covered by these automated tests.

## Local territory E2E and frontend data

From this frontend directory, run:

```sh
POSTGRES_BIN=/path/to/postgresql/bin npm run local:e2e
npm run dev
```

The first command compiles the current contracts, checks ABI/schema alignment,
starts an isolated Hardhat chain and PostgreSQL instance, and runs the backend's
real indexer, keeper and publisher scenarios. It then serves the resulting
publication over HTTP and verifies the frontend's actual hydration and token
history rendering. This is an integration test; it does not drive a browser or
injected wallet.

Successful runs save public artifacts in `.local-territory/runs/` and atomically
update `.local-territory/current.json`. The development server reads that pointer
on each runtime-config request, so refreshing the page picks up the newest run
without editing an address, token ID or manifest URL. Failed runs leave the last
successful publication selected. The PostgreSQL binary path is remembered after
a successful run; subsequent runs on the same machine use `npm run local:e2e`.
Alternatively, set `E2E_DATABASE_URL` to an isolated localhost PostgreSQL server;
its credentials are never saved in the frontend artifacts.

Hardhat/PostgreSQL stop after the test. Published snapshots remain browsable,
but wallet transactions require a running chain. Do not use these snapshots for
transactions on another chain or a new deployment. Old round data is not imported.

Production builds do not select local test data. Set `BATTLEBROS_MANIFEST_URL` to
the real publication URL, or set `BATTLEBROS_DEPLOYMENT_MANIFEST` to the deployment
JSON and configure the publication origin/bucket. URLs are derived from that
manifest's actual chain ID and TerritoryCombat address. Without either setting,
the UI reports that no deployment is configured instead of contacting the example
addresses. A `?manifestUrl=...` URL override takes precedence in both frontend views.

## Unhatched Home

Use **Test unhatched mode** in the Stats menu to preview the cube and hatch setup
without S3 data or a wallet. **Exit unhatched preview** restores the latest
published state (or the normal local world if no publication is configured).
Preview drafts are separate from real BattleBro drafts; the toggle resets on
reload and never changes published hatch status.

The selected active BattleBro's confirmed S3 `hatchedAt` field drives Home's
unhatched mode. An unhatched Bro replaces its roaming character with a large
violet incubation cube with a pulsing red seam at the grid center. Its footprint is
protected while the rest of Home remains editable. The cube is a scene object,
not a serialized terrain/building edit; world reloads reposition the same model.

The Stats menu shows an Unhatched BattleBro section for a name, one of the four
character families, and three training percentages totaling 100%. These are
local drafts scoped by chain, deployment, and token ID. They do not submit a
hatch transaction, select an onchain kind mapping, or change published status.
Refresh hatch status reloads the existing publication without using an RPC.

Transport, travel to other worlds, flight, arena entry, and training-building
entry are blocked until a confirmed hatched record arrives. Walking and Home
construction remain available. Failed publication reads preserve the last
confirmed mode. Confirmed hatching hides the setup section/cube and restores the
existing character. No new animation loop or per-frame blockchain/S3 reads are
introduced. `node tools/unhatched-home.test.js` covers the controller, production
entry guards, scene lifecycle, collision/spawn behavior, and local draft rules.

## Seeded local game and transaction development

Run from this frontend directory:

```sh
LOCAL_PLAYER_ADDRESS=0xYourPublicWalletAddress npm run local:dev
```

Use your public browser-wallet address (no private key). After a successful start,
the runner remembers it in ignored `.local-territory/player.json`; later starts
only need `npm run local:dev`. You can also connect your wallet on the local
transaction harness, click **Use connected wallet on next start**, and restart
once. Without a saved address, the player defaults to Hardhat account 1; the
terminal and harness show the exact owner. Account 0 and account 2 are reserved
for administration and the opponent.

The default `established-v1` scenario is a running game, seeded through real
contract transactions before the indexer publishes its initial snapshot:

| BRO | Owner | Starting state |
| --- | --- | --- |
| 1, 2 | Your wallet | Hatched, open care Needs, previous care completions |
| 3 | Your wallet | Level 2, 16 battle wins, defending territory 2 |
| 4 | Your wallet | Level 2, 16 battle wins, cared for, trained and ready to claim |
| 5, 6 | Your wallet | Minted, unhatched, yield available for hatching |
| 7 | Opponent | Hatched, battle history, defending territory 1 |
| 8 | Opponent | Hatched, previous care completed, free |

Territories **3 and 4 are open** and can be claimed by BRO #4. The player starts
with 100 test ETH. The fixture advances training time, adds mock staking yield,
fulfills mock VRF requests, and earns XP through 32 resolved battles. It does not
write contract storage or change progression/needs rules. Defenders remain exempt
from daily Needs under the existing rules. All pending battles are resolved at startup.

Open **http://127.0.0.1:3012/index.html?battleBroId=1**, connect the remembered
wallet, and switch to local chain 31337. Expand **Needs & worlds** at the top
right to see both open Needs. Click **Review care**, then **Confirm care**, and
approve the transaction. Use the BRO selector for the defender or unhatched BROs.
The territory dashboard supports claiming the open land with BRO #4. The harness
at `/local-transactions.html` lists the scenario roster with direct Home links.

`npm run local:dev` starts its own frontend. Use its displayed URL; a separate
`npm run dev` on port 3000 reads the saved static fixture and is a different mode.
Restarting `local:dev` creates a fresh established game with stable BRO IDs and
your remembered owner; it does not resume the previous run's transactions.
For blank-chain mint tests use `LOCAL_SCENARIO=empty npm run local:dev`.
`npm run local:scenario:test` verifies the scenario, real Needs completion and
an open-territory claim through the frontend services and confirmed publication.

The runner also checks the previous local E2E PostgreSQL path, project-local
binaries under `.local-territory/postgres/root/usr/lib/postgresql/*/bin`,
and `pg_config`. A stale path under `/tmp` falls back to these locations.
Alternatively set `LOCAL_DATABASE_URL` to a local PostgreSQL server. Migrations
run in a newly created, isolated schema; existing schemas are not reset.
Contracts, frontend and backend dependencies must already be installed.
No Infura key, mainnet fork, real ETH, production AWS credentials, or public-chain
contract deployment is used.

The defaults are frontend **http://127.0.0.1:3012/** and
Hardhat RPC **http://127.0.0.1:8545**, chain ID **31337**. Override them with
`LOCAL_FRONTEND_PORT` and `LOCAL_RPC_PORT` if necessary. An occupied RPC port is
rejected; the runner never deploys into a node it did not start. The wallet must
use the displayed RPC, not another local chain with the same ID. Anchor-block
checks enforce this before requesting a write.

The runner compiles and checks canonical ABIs, deploys the real territory
contracts with stETH/VRF mocks, creates a private PostgreSQL cluster or schema,
and runs the existing indexer and publisher. The publisher's AWS SDK writes to
an isolated local S3 HTTP sink. Those immutable snapshots and the mutable
manifest are served through the frontend's ordinary public-data reader.
Indexer and publisher remain separate processes with separate credential sets;
no keeper or gameplay signing worker is needed to construct this fixture.
After startup there is no automatic battle/Needs keeper; newly requested mock
randomness is not automatically fulfilled by this scenario script.

Regular one-second block production advances confirmations even without more
transactions. Local transaction confirmations and indexer depth are configured
as 2 for quick iteration; the shared transaction service defaults to 12 when no
explicit policy is configured. Confirmed transactions can still be awaiting the
indexer/publication, and those states are shown separately.

Use the harness as follows:

1. Connect an injected EOA wallet and switch/add the displayed local network.
2. Click **Fund connected wallet** to give that address 100 test ETH on this
   local chain. No Hardhat private-key import is necessary.
3. Click **Mint with 1 test ETH**. The service simulates before opening approval.
4. Watch Pending → Included → Confirmed → Reflected in published game state.
5. Follow **Enter Home with BattleBro #…**. The actual published `hatchedAt: "0"`
   record activates the incubation cube, rather than the preview button.
6. Use **Hold mining**, **Speed up**, **Cancel**, and **Resume mining** to test
   pending/replacement flows. Pause/resume the publisher or indexer to test lag.
7. Reload, navigate to Home, or disconnect the wallet while tracking. Submitted
   transactions continue to be checked against the application's local RPC.

The harness and control route are available only from a server launched by this
runner. They are omitted from the production static build; cross-origin control
requests are rejected. The Home Stats menu exposes a harness link only for this
local runtime. A normal `npm run dev` does not start the persistent chain.

Press Ctrl+C to stop the stack. Node/database processes are long-lived during a
run; restarting the command creates a fresh chain, fresh schema and fresh run
identity. Pending records from old local runs are isolated. Private database
files, deployment metadata and logs remain under backend `.local-dev/`, outside
the served frontend root. Public snapshots remain in frontend `.local-territory/`.
Local database files/logs are intentionally retained for inspection after stop.

### Shared transaction API

`wallet/transactions.mjs` exports `createTransactionService`. The wallet bundle
exposes `transactionsReady`, which resolves to a service only when a trusted
RPC/deployment is explicitly configured. Transaction code loads separately from
wallet connectivity. Consumers call, for example:

```js
const service = await transactionsReady;
const transaction = await service.submit({
  contract: 'bros', functionName: 'mintWithETH', value: 10n ** 18n,
  label: 'Mint BattleBro'
});
```

The return value means submitted, not confirmed. Subscribe to `service.list()`
updates, or use `subscribe`, for lifecycle state. Use `awaitPublication: false`
for preparation transactions whose confirmation alone advances a multi-step
flow, such as token approval. Full ABIs come directly from canonical exports.
The territory dashboard's older transaction handlers are retained; migrating its
individual gameplay actions is separate from this development mint harness.

The service validates the trusted target, RPC chain, wallet session and optional
deployment anchor, then uses Viem simulation/encoding. It stores bounded public
metadata (sender, nonce, destination, value, calldata digest and transaction
hashes), not private keys, signatures or signing payloads. Browser storage is
best-effort; failures show a warning without treating a submitted write as failed.
No uncertain submission is automatically resent.

Tracking uses receipts and bounded block scans by sender/nonce, including when a
replacement was mined before a page reload. Repriced transactions continue the
original action; cancellation and different-payload replacements do not report
that action as successful. Confirmed transactions awaiting publication are
rechecked for reorgs. Completion uses the configured confirmation policy, not a
claim of Ethereum finality. Published results must pass deployment, content-hash,
snapshot and canonical-block checks. Mint receipts identify token IDs; published
token presence completes mint reconciliation. Other actions use indexed history
by transaction hash and can gain action-specific reconciliation as their UIs ship.

`npm run transactions:test` covers simulation errors, rejection, persistence,
replacements, cancellation, reorgs, uncertain submission, storage failure and
wrong local-chain protection. With PostgreSQL available,
`npm run local:transactions:test` starts a fresh isolated stack and verifies the
real service → mint → indexer → publication → actual Home reader/cube path,
plus wallet-independent recovery, speed-up, cancellation, and reset isolation.
The integration test uses local unlocked RPC accounts as a wallet adapter;
actual extension dialogs still need a manual browser check before testnet release.

## Needs and signed world saves

The **user stats** panel lists the connected wallet's BROs and active Needs. Select a BRO to view its profile, review its activity, and confirm care using the existing transaction service. Confirmation is shown separately from S3 synchronization. The initial activity is generic care; the six brief gameplay activities will be implemented individually.

The saved `npm run local:e2e` fixture leaves BRO #1 hatched with an active care Need, ready to inspect in Home (`index.html?battleBroId=1`). Its care regression uses BRO #4 so the default BRO's Need remains available. Rerun the fixture to refresh existing saved data. The fixture stops its chain after publication; wallet completion requires a running chain such as `npm run local:dev`.

Configure `worldApiUrl` in the public-data configuration (or `BATTLEBROS_WORLD_API_URL`) to enable signed cloud saves. Selecting an owned BRO automatically loads its Home world, restoring its local draft or saved revision. The first owned BRO also loads automatically after connection. In the toolbar’s **World** menu, choosing **Occupied territory** loads that BRO’s territory; selecting another BRO returns to its Home. Switching preserves the outgoing world’s local draft, and background publication refreshes leave the editor unchanged. **Save world** becomes available after loading and asks you to sign that revision. If loading fails, **Refresh BROs** retries it. Local drafts survive refreshes without a signature. **Load saved world** explicitly discards a draft in favor of the latest accepted save if another device has updated the world. Homes stay with their NFTs and territory worlds stay with their locations.

`npm run local:dev` includes the world API. Hosted installations require the backend additive migration and the `dev:world-api` service; see [backend setup](../battle-bros-backend/docs/needs-and-worlds.md). No production deployment or S3 publication is performed by the frontend build.

### Add local test yield for hatching

After minting, use **Add test yield (+1%)** on the local transaction page, or run in a second terminal:

```sh
npm run local:yield
# If the frontend uses another port:
npm run local:yield -- --url http://127.0.0.1:3019
```

Keep `npm run local:dev` running. This calls the same local-only control as the button and submits a real positive rebase to that run's mock stETH. It increases the value of all existing deposits by 1%; it does not lower the hatch threshold or automatically hatch a BRO. A fresh 1 ETH BRO gains approximately 0.01 stETH yield, above the 0.0019 requirement. A later mint needs a later yield update. Resume mining first if it is paused.

Wait for the indexer/publisher, refresh the Territory dashboard, enter a name, and use **Hatch with balanced weights** from the owning wallet. Refresh Home after confirmation to see the hatched state. Advancing time alone does not generate mock yield.

### Selected BRO and cosmetics

The selected BRO's published kind now selects its 3D character family automatically. The character preview tab remains available for temporary type/form testing. Skin and core/accent/eye colors are stored separately for each NFT, with local drafts and owner-signed cloud saves.

Select a BRO in user stats and use the Training Center to edit its skin/colors. Leaving the facility requests an owner signature to save changed appearances; leaving without changes does not request a signature. Unsynced appearance drafts are retried when leaving a later facility visit. Signature rejection or a cloud revision conflict keeps the local draft. Cosmetics follow the NFT when ownership changes. Form/type overrides from the preview are not persisted. Restart the local stack to load the updated API/publisher; each local stack restart creates a fresh chain.
