# Store 0.7.0 — Myelin arcade collection

Four free single-player games join the existing collection: Prism Breaker (brick breaker), Neon Coil (snake), Starfall (formation shooter), and Drift Run (lane dodger). All eight bundled games display the supplied Myelin logo and a `MYELIN BASED` tag on their cards and inside their game shell. The new games support keyboard and touch controls, pause/resume, optional synthesized sound, saved runs, replay verification, and signed export.

## Runtime and evidence

`games/arcade` is a separate Rust application pinned to Myelin v0.31.0, commit `c0ac291c03ed8996e62834cb3f480e1ce8dc09a2`. Its compiler is Rust 1.97.1. The four games share a private HTTP service at port 8785; account and game identifiers select distinct RocksDB directories and authority keys. The gateway supplies the authenticated account and runtime secret. No runtime port is published publicly.

The browser predicts a 30 Hz integer simulation and sends input tapes approximately once a second. Each accepted tape has 1–60 five-bit control samples. Rust executes the same rules, derives the score and full state, and commits a signed Myelin session frame. The server never accepts a client score or state. Requests bind the exact session id and previous block hash. On a network failure, the browser pauses and reloads confirmed state; at most the unsent tail can be lost. Runs stop at 18,000 ticks (10 minutes). There are no public competitive leaderboards or score rewards; fixed-seed gameplay and input-tape verification do not prove human play or wall-clock pace.

The application profile binds the particular game, Rust rules, executor source, dependency lock, input/state schemas, deterministic entropy policy, resource envelope and off-chain replay scope. Account storage is durable across service restarts. Exports can be verified with the exact matching binary:

```sh
myelin-arcade verify prism-breaker-myelin-session.json
```

Evidence means closed-authority, off-chain host execution and replay. It does not mean CKB scripts were executed, a transaction was accepted or settled, or a public-testnet court was established. The UI and API preserve this distinction. Existing game runtime artifacts and session formats are unchanged.

## Selection and provenance

Selection considered browser-native arcade projects, including [Akshat Jain's Breakout](https://github.com/akshatjain02/Breakout), [Dave Kerr's Space Invaders](https://github.com/dwmkerr/spaceinvaders), and [Canvas Arcade](https://github.com/FabianoArthur/canvas-arcade). These are useful genre references, but browser-local simulation and scores do not provide Myelin evidence on their own.

This release implements original rules, renderer, covers and synthesized sounds for four established arcade genres. It does not copy those projects' source, artwork, characters, trademarks or sound assets. The Myelin logo is the image supplied by the site owner. New source follows the existing MIT game license under `games/arcade/LICENSE`.

## Reproducible checks

```sh
npm ci
npm test
npm run build
cargo +1.97.1 fmt --manifest-path games/arcade/Cargo.toml --check
cargo +1.97.1 test --locked --manifest-path games/arcade/Cargo.toml
cargo +1.97.1 clippy --locked --manifest-path games/arcade/Cargo.toml --all-targets -- -D warnings
cargo +1.97.1 build --locked --manifest-path games/arcade/Cargo.toml
node tests/arcade-conformance.mjs
STORE_URL=http://127.0.0.1:8795 node tests/live-arcade.mjs
```

The conformance suite compares full Rust and browser states across 144 deterministic tapes, including fixed controls, pseudo-random combinations and directed play. There are 259,200 supplied input ticks; terminal runs intentionally ignore their remaining inputs. Live tests exercise every game through the real store gateway with two isolated guest accounts, stale-head and malformed-input rejection, replay and export. Rust tests cover signed recovery, profile isolation and tampering.

Release verification on 2026-10-23 passed 37 Node tests, six Rust tests, strict Clippy, formatting and production build. The portable Debian binary passed the same 144 conformance tapes. Public HTTPS tests passed for all four arcade games, including offline verification of their actual exported signatures and state roots; the existing Chess/Skyward gameplay smoke also passed. Store and arcade reported healthy on `utxoplay:0.7.0`. The deployed native binary SHA-256 is `0cf0f157892847bd82493105e01e704bc12866a31ef2353cb7fd6d54c803230c`.

The in-app browser could not attach during this release session. Automated runtime and HTTP checks are not a substitute for visual inspection or physical touch-device acceptance; those checks remain outstanding.

## Build and deployment

Build the native binary in Debian Bookworm using `deploy/ArcadeBuilder.Containerfile`. Preserve the matching Cargo.lock and binary with the release; changing the rules or executor fingerprint prevents recovery under the old profile. The existing Chess/Skyward binaries remain in `deploy/bin` for their unchanged images; copy the new `myelin-arcade` binary there before building `deploy/Dockerfile`.

Store and arcade use `utxoplay:0.7.0`. Other services retain their previous image tags. Persistent arcade data lives at `/data/utxoplay/shared/arcade` and must be writable by UID 1000. Back up the live platform SQLite database with SQLite's backup API and retain the previous compose file and image before switching only `store` and `arcade`.

To roll back the store, run the previous release's compose definition with project name `utxoplay` and recreate only `store`; then stop the unused arcade service. Keep its data and matching image for a later recovery. A store rollback does not require overwriting account, purchase or game data.

## Store 0.7.1 logo delivery fix

The uploaded logo retained file mode 0600. Docker COPY made it root-owned, so the unprivileged website process could not read it and the image URL returned HTTP 500. The image build now normalizes public static directories to 0755 and static files to 0644 before switching to the node user. Logo references use a fresh query version to avoid cached failures. Only the store image advances to 0.7.1; the arcade runtime and game session profiles remain unchanged.

## Store 0.8.0 arcade presentation update

The four arcade entries now use original generated key art on store cards and welcome screens. Full generation prompts and source paths are recorded in `docs/arcade-art.json` (built-in `image_gen.imagegen`, four distinct assets). Production uses 1536×1024 WebP encodings at quality 82, 166–260 KiB each. No generated logo replaces the owner's supplied Myelin mark. In-game sprites remain authored Canvas geometry and keep the original collision dimensions.

The new renderer separates presentation from the deterministic engine. It interpolates adjacent simulation states, uses collision-positioned crystal fragments, pickup rings, enemy bursts and score labels, and gives ships, snake segments, bricks and the car shaded surfaces. Particle motion uses elapsed time and a bounded pool; reduced-motion mode suppresses particles, moving scenery, trails and bloom. Low-power/automatic resolution controls and visibility-aware scheduling share the existing performance helper. Hidden tabs pause and stop the render loop. Synthesized event-specific audio is opt-in and remembers the device preference.

Snake input buffers two legal turns across movement ticks; runner presses queue one lane change and wait through cooldown. Keyboard and touch sources release independently. Start/resume has a short countdown. Pause, loss of focus and disconnect clear held inputs; new-run confirmation pauses first. Best scores are device-local and updated from confirmed saves, not a public leaderboard. Routine saves no longer repeatedly announce through a screen reader. Small landscape layouts move controls beside the board.

The Rust source, Cargo.lock, `engine.mjs`, signed application profiles and runtime binary are unchanged. Only the store image advances to `utxoplay:0.8.0`; the arcade service stays on `utxoplay:0.7.0`. Deploy/revert only the store with `docker compose -p utxoplay -f <release>/deploy/compose.yml up -d --no-deps store`. Do not stop the arcade service or replace persistent data when reverting this presentation update.

Validation on 2026-10-23:

- `npm test`: 44 passing tests, including seven input/feedback/particle regression tests.
- Production build succeeds; only existing dependency bundling warnings remain.
- The exact deployed native binary passes all 144 conformance tapes (259,200 input ticks).
- All four games pass authenticated live gateway tests against the real local runtime, including isolated accounts, stale/malformed rejection, signed replay and offline export verification.
- A temporary jsdom + native Canvas harness executes the actual frontend module for each game against that runtime: boot, countdown, keyboard events, save, pause, resume, replay and window blur pass without script errors. This is not browser layout validation.
- Actual Canvas renders were inspected in normal mode and exercised in low-power/reduced-motion modes. Contact sheet: `artifacts/arcade-polish/gameplay-contact.png` (local verification artifact, not shipped).
- The browser attachment timed out, so browser screenshots, physical touch gestures and subjective audio/animation checks remain unverified.

## Store 0.8.1 play-flow update

This update focuses on playing, pausing and trying again. Inputs held during the countdown carry into the first tick. Mouse movement aims the paddle/interceptor; touch dragging steers relative to its initial position without jumping toward the finger. One swipe commits one turn or lane change, and a second finger cannot take over the board gesture. Neon Coil has a spatial D-pad with keyboard-operable buttons. Starfall offers a persistent Auto fire switch (enabled initially); this emits the same ordinary fire inputs, with the native rules and cooldown unchanged.

New-run confirmation now stays inside the game, with a Keep playing action. P toggles pause/resume, R opens the confirmation and Enter activates play from the board. End-of-run score, duration and device best appear immediately while the final save is pending; the replay button becomes available after confirmation. Ties no longer claim a new record. Action buttons lock during async operations, duplicate starts cannot create duplicate sessions, and blur/hidden state invalidates a delayed resume. A failed action plus failed recovery read can reconnect and start with a single click. Routine runtime evidence remains unchanged.

Verification: 49 standard tests pass, including long-swipe, pointer ownership, relative drag, cancellation and result-summary regressions. `tests/arcade-flow.mjs` exercises the actual frontend module with a DOM harness and a real isolated native runtime: countdown inputs, paused-state stability, signed replay, cancel restart, duplicate confirmation, delayed network responses during blur, failed-save recovery, reconnect and slow final-save results. It also verifies Starfall can turn automatic fire off. Install the optional harness dependency outside the production tree and point it at the isolated local store:

```sh
npm install --prefix /tmp/arcade-test --no-audit --no-fund jsdom
ARCADE_TEST_MODULES=/tmp/arcade-test/node_modules STORE_URL=http://127.0.0.1:19090 node tests/arcade-flow.mjs starfall
# Repeat for prism-breaker, neon-coil, drift-run.
```

Browser attachment still times out; the DOM harness does not establish physical touch feel, browser layout or audio quality. Only the store image changes to `utxoplay:0.8.1`; the native image and persisted profiles stay on the existing runtime. Deploy/revert only the store, preserving game data and the supplied logo.

## Store 0.8.2 rendering performance

Static scenery and brick layers now reuse raster caches, paused scenes stop drawing after effects settle, and unchanged HUD values avoid DOM writes. ResizeObserver supplies canvas dimensions and quality settings are cached between preference events. Native rules, timing, save cadence and runtime image stay unchanged. Benchmark method, before/after numbers, pixel validation, bounded memory tradeoffs and reproduction commands are in [arcade-performance.md](arcade-performance.md).
