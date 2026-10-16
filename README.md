# BattleBros territory frontend

The Three.js world consumes territory publications; territory.html provides wallet actions. Only territory schemaVersion 2 / projectionVersion 3 is supported.

Run npm test and npm run build. Build only writes dist; it does not publish. Configure BATTLEBROS_DEPLOYMENT_MANIFEST and BATTLEBROS_MANIFEST_URL for an actual deployment. deployment/territory.example.json is illustrative, not a deployed network.

From contracts, npm run interfaces:sync regenerates canonical ABIs, backend copies, frontend selectors, and public schemas. npm run interfaces:check checks all consumers.

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
