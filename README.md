# BattleBros territory frontend

The Three.js world consumes territory publications; territory.html provides wallet actions. Only territory schemaVersion 4 / projectionVersion 5 is supported.

Run npm test and npm run build. Build only writes dist; it does not publish. Configure BATTLEBROS_DEPLOYMENT_MANIFEST and BATTLEBROS_MANIFEST_URL for an actual deployment. deployment/territory.example.json is illustrative, not a deployed network.

From contracts, npm run interfaces:sync regenerates canonical ABIs, backend copies, frontend selectors, and public schemas. npm run interfaces:check checks all consumers.

## Endless NPC pursuit

NPC BattleBros detect the player within 10 world units on the same island when
their full body has a clear, supported path. They pursue using the shared Home
run, gallop, fast-float or juvenile support controller. Leaving the island,
blocking the path or exceeding 14 units ends pursuit.

Body contact briefly locks movement, pans the camera toward the Bro and shows a
red screen cue. The player regenerates on safe terrain about 3–10 units away on
the same island, with five seconds of protection from every NPC. Tiny islands
without another safe patch retain the current spot and still grant protection.
H and Escape remain available during the catch. These are local exploration
effects; they do not change territory contract state. Timing and range defaults
live in `assets/endless-pursuit.js`.

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

## Persistent local mint/transaction development

Run from this frontend directory:

```sh
POSTGRES_BIN=/path/to/postgresql/bin npm run local:dev
```

The runner also checks the previous local E2E PostgreSQL path and `pg_config`.
Alternatively set `LOCAL_DATABASE_URL` to a local PostgreSQL server. Migrations
run in a newly created, isolated schema; existing schemas are not reset.
Contracts, frontend and backend dependencies must already be installed.
No Infura key, mainnet fork, real ETH, production AWS credentials, or public-chain
contract deployment is used.

The defaults are frontend **http://127.0.0.1:3012/local-transactions.html** and
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
no keeper or gameplay signing worker is needed for these mint scenarios.

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
