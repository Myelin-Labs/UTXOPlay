# UTXOPlay

A deployed browser game store at https://store.utxoplay.io. The collection contains The Quiet Board (same-device two-player chess), Skyward (single-player slingshot), Teeworlds (online duels and practice), and OpenStrike (first-person online duels and practice).

## Shipped in this release

- Responsive game store, search, genre filters, embedded play, fullscreen and library.
- Isolated guest saves and persistent wallet-linked saves. Guest and wallet libraries are separate.
- CCC mainnet wallet discovery for native CKB, Bitcoin ECDSA and JoyID Passkey accounts. Server verifies a browser-bound one-use challenge and binds the signature to the CKB lock.
- JoyID credential-to-address binding uses the fixed JoyID credential API and fails closed. Temporary JoyID session keys are not supported.
- Rust Myelin runtimes with per-account storage, bounded open-session caches, signed records, replay and export.
- Self-service vendor publication with private/live drafts, vendor-hosted Myelin instance checks and a server-side launch adapter. Free publication is the recommended default.
- CKB mainnet one-time purchases with no scheduled access expiry, direct Store 20% / vendor 80% outputs, saved receipts and confirmed revenue reporting. Paid publication/checkout require the operator’s actual `STORE_CKB_ADDRESS`.

Vendor games open on their own HTTPS origins using scoped launch tickets. Remote chess rooms are not implemented. Chess/Skyward run on server-side Rust; Teeworlds runs its original C++ simulation and OpenStrike its original Rust simulation, both with Myelin replay verification; wallet login does not submit blockchain transactions.

## Local development

Requires Node 22.23+ and the Rust game binaries. Install with `npm ci`, build with `npm run build`. Build each game's manifest with Rust and Clang/protoc, or use the Podman builder in `deploy/Builder.Containerfile` (its base is the local pre-existing compiler image). Game sources retain their exact Myelin dependency revision. The standard reproducible compiler recipe is in `deploy/PortableBuilder.Containerfile`.

Set a random `RUNTIME_TOKEN` shared only by the platform and game processes. Run each game with its own `DATA_DIR`, ports 8781 and 8782, and `BIND=127.0.0.1`. Run `npm start` on port 8790. The default `PUBLIC_ORIGIN` is http://127.0.0.1:8790. Vite development requires `PUBLIC_ORIGIN=http://127.0.0.1:5173` on the API service.

```sh
npm test
node tests/live-smoke.mjs
node tests/live-auth.mjs
node tests/restart-smoke.mjs
node tools/utxoplay.mjs check game.manifest.json
```

The live smoke uses two disposable guest accounts and runs both games through the real gateway. Set `STORE_URL` to run against the public deployment. It creates test gameplay records but does not publish projects or transfer funds.

## Release verification

The initial deployment passed six Node tests, nine Rust game tests, public gameplay smoke tests for both games, and public cryptographic CKB login/logout/relogin tests. Both real runtimes recovered their exact saved state and verified replay after a forced process restart in disposable local directories. Production health and all game/frontend assets returned successfully over HTTPS.

Browser interaction checks covered the local storefront, mobile layout, chess moves, slingshot play and replay, and the wallet chooser. The embedded browser timed out navigating the public domain, although direct HTTPS and public API checks passed. Actual JoyID Passkey prompts and each installed wallet extension still require device-level acceptance testing; synthetic signature tests do not establish every wallet/browser combination.

## Deployment

The server deployment is under `/data/utxoplay`. `deploy/compose.yml` uses the existing external `stack-network` HTTPS proxy and a private game network. No game runtime port is exposed publicly. The proxy discovers the store through `VIRTUAL_HOST` and manages certificates for store.utxoplay.io, utxoplay.io and www.utxoplay.io. The latter two redirect to the canonical store origin.

Build the game binaries on Debian Bookworm and copy them into `deploy/bin`. Build the frontend locally, then build the server image with `docker build -f deploy/Dockerfile -t utxoplay:0.6.0 .`. The server-side runtime secret is generated on the server, stored in `shared/runtime.env` with mode 0600, and never committed. Persistent platform and game directories must be writable by container UID 1000. Services restart automatically and have memory, CPU, process, privilege and log-size limits.

For upgrades, preserve `shared/` and record the existing image tag before recreation. Changing game rules or Myelin's pinned revision can invalidate existing exports: preserve matching runtime images and do not replace game state indiscriminately. A release pointer does not migrate old sessions.

Back up platform SQLite with its backup API and game stores while their writers are stopped, together with runtime images and authority key files. Treat backups as private. Backups are not yet scheduled by this release.

## Source provenance

Game snapshots are based on Myelin Chess `321c4bfc35a1560d0b4eebc1a011a876c1bb263a` and Myelin Sling `c3dbd83380ae11499b71c0fd3fdb87f34f7cf126`. Platform adapters replace their single shared HTTP session with account isolation. Original rules and session formats are retained. Their MIT licenses, asset provenance and music attribution are included under `games/` and inside the game credits.

## Teeworlds release

The third game is maintained in https://github.com/Myelin-Labs/myelin-teeworlds, derived from xxuejie’s fixed-point CKB fork. `games/teeworlds/web` is its static browser client; the dedicated `myelin-teeworlds:0.1.0` image runs private room/engine/replay services. Only the store image advances to `utxoplay:0.2.0`; existing chess and sling services retain their original image and data. Preserve `/data/utxoplay/shared/teeworlds` across releases.

The gateway injects the authenticated account, enforces same-origin writes, and caps room creation at 20/hour/account. The private room service caps concurrent arenas at eight. Each 60-second round is replayed and sealed in Myelin; this is native replay, not CKB settlement. A finished match survives restart; an unfinished match is marked interrupted. See the game repository for matching engine/verifier artifacts and independent verification instructions.

### Local platform

Build with `npm run build`, then run `npm run dev:platform` to start the store and all four game runtimes together. Stop any existing processes on ports 8781–8784 and 8790 first. The launcher requires the Chess/Skyward binaries in `deploy/bin/` and a built sibling `myelin-teeworlds` checkout (or set `TEEWORLDS_ROOT`), plus a built sibling `myelin-openstrike` checkout (`OPENSTRIKE_ROOT`). It uses separate persistent local game directories under `data/`. Ctrl+C stops every child service; if any runtime fails, the launcher stops the platform rather than leaving an apparently playable, disconnected page.

Games enter immersive mode on a Play/Start click and request browser fullscreen in that user gesture. Browsers that reject fullscreen retain the immersive page layout. Exit or Escape restores the store. The shared first-party game shell validates the sender and origin of frame messages.


## OpenStrike release

`myelin-openstrike:0.1.0` adds the fourth game with an original browser renderer and the upstream native OpenStrike simulation. The source, English architecture, API guide and verifier are published at https://github.com/Myelin-Labs/myelin-openstrike. Store 0.3.0 adds catalog entry, static assets and account-authenticated HTTP/WebSocket routing to port 8784. Preserve `/data/utxoplay/shared/openstrike`. The existing three runtimes keep their images and data.

Public play is free. Fiber is retained only in the upstream native developer testnet path. `node tests/live-openstrike.mjs` exercises disposable CKB sign-ins, a two-account duel and verified export without transactions; set `STORE_URL` to test a deployment. The export must be verified using its matching native binary pair.

## Store 0.4.0 interaction refresh

A redesigned dark storefront adds game details, play-style filters, recent play, clearer loading/retry states, accessible dialogs and a mobile drawer. The developer studio includes manifest copying, reference links and persistent in-page draft fields. Motion is bundled locally, follows reduced-motion preferences and can be disabled in Display preferences. Cover WebP variants reduce their combined transfer size by 89%.

Game entry waits for a same-origin ready signal and offers a retry if loading stalls. Actual game starts request fullscreen, with an immersive layout fallback; controls and reload confirmation remain available. Only the store image advances to `utxoplay:0.4.0`; game runtime images and persistent data remain unchanged. See [the interaction audit](docs/interaction-audit.md) for findings, verification and device limits.

## Store 0.5.0 marketplace

See the [English architecture and business-flow audit](docs/marketplace-architecture.md), [vendor hosting guide](vendor/README.md), and [environment template](vendor/vendor.env.example). The browser guide is served at `/publishing.html`. Studio supports connection checks, live publication, price changes, unlisting and sales; players get clear host/price information, Purchases and retained library access.

Set `STORE_CKB_ADDRESS` to the actual Store mainnet public receive address in the existing server-only environment file. Do not set a sample address. Until configured, the site explicitly keeps paid publication and checkout unavailable while free publication works. The Store does not hold wallet keys or take custody of revenue. No live mainnet payment was made by the automated test suite.

Run `npm test` and `npm run build`. `node tests/marketplace-browser.mjs` starts a disposable localhost-only browser fixture at port 8795; its test login and simulated network checks must never be deployed. Mainnet payment acceptance across supported wallets still requires a funded, user-approved device test.

## Store 0.6.0 performance

Wallet and commerce tools load on demand. First-party games share visibility-aware rendering/polling; Teeworlds caches terrain, OpenStrike batches static geometry, and the chess board preserves square elements. Display preferences offer adaptive, high-detail and performance graphics. Static delivery uses prebuilt Brotli/gzip and immutable hashed bundles. Native simulation, replay formats and marketplace settlement rules remain unchanged. See [performance audit](docs/performance-audit.md) for measurements and validation.
