# BattleBros territory frontend

The Three.js world consumes territory publications; territory.html provides wallet actions. Only territory schemaVersion 4 / projectionVersion 5 is supported.

Run npm test and npm run build. Build only writes dist; it does not publish. Configure BATTLEBROS_DEPLOYMENT_MANIFEST and BATTLEBROS_MANIFEST_URL for an actual deployment. deployment/territory.example.json is illustrative, not a deployed network.

From contracts, npm run interfaces:sync regenerates canonical ABIs, backend copies, frontend selectors, and public schemas. npm run interfaces:check checks all consumers.

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
