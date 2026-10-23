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
