# Prism Breaker crystal collection — store 0.15.0

Prism Breaker 0.3.0 replaces its procedural gameplay objects with original imagegen artwork: six cut-crystal bricks, a platinum/amethyst paddle, pearl orb, crystal shard, lens, impact star and heart, plus Violet Sanctum and Aurora Conservatory environments. The realm changes every two waves. The cover and game-owned menu use new matching artwork. Four source images and their complete built-in imagegen prompts are retained in `assets/prism-breaker-source/` and `docs/prism-breaker-art.json`. `tools/pack-prism-art.mjs` extracts, silhouette-clips and encodes the generated artwork; the 14 in-game WebP files total about 536 KB. No new production dependency is required.

Focus Lens is an optional projected trajectory and landing marker, toggled inside the game or with F. It runs a disposable copy of the existing discrete simulation with the paddle held still. It neither steers the paddle nor changes score, inputs or authoritative state. The resonance display exposes the existing capped 8× combo; it does not create a new reward. Collision geometry, native execution, saved sessions and Myelin profiles remain unchanged. Myelin here means off-chain host-signed replay, not on-chain settlement.

The mature GitHub reference is [Jake Gordon's javascript-breakout](https://github.com/jakesgordon/javascript-breakout), pinned at `eed59e2affa9423b93d2ac8ff93061bb88b33284`. Its MIT `Game.Math.intercept` segment-intersection helper is adapted for the landing guide, with attribution and license shipped in `games/arcade/web/vendor/` and accessible from the in-game credits. This is a targeted reuse, not a wholesale game port. No upstream artwork, levels or separately licensed sounds are imported.

The shared loader now waits for all 15 decoded artwork resources (including the cover) and the session before accepting game readiness. A broken asset fails the artwork stage. Standalone loader elements survive game-shell mounting. Background and brick layers are cached, effects are bounded, low-power and reduced-motion modes are respected, and idle frames are skipped. All controls stay inside the game viewport.

## Validation

- `npm test`: 61 passing tests, including artwork gate/rejection and read-only focus-path geometry.
- `npm run build`: production bundle and precompressed resources.
- `tests/arcade-conformance.mjs`: 144 full-state Rust/browser tapes, 259,200 input ticks.
- `tests/arcade-flow.mjs` against an isolated native arcade/store: all four arcade games pass countdown input, pause, signed replay, restart cancellation, duplicate-click protection, delayed-request/blur, dropped save and one-click reconnect. Prism additionally decodes the actual artwork and checks the lens switch and heart HUD.
- `tests/prism-render.mjs`: actual WebP decoding and rendering of both realms, effect limits, idle skip, quality/lens invalidation and resizing. Native Canvas CPU microbenchmark: approximately 0.32 ms median / 0.42 ms p95 at 1000×1000; this is not a browser FPS or physical-device measurement.
- Shared shell checks cover all nine games and standalone loader preservation; loader contracts cover actual asset gates, frame boundaries, stale messages, failures and retry.
- In-app Chromium acceptance through the local store guest route: new menu, live gameplay, focus toggle and responsive layouts at desktop, 390×844 and 844×390. No application console errors observed. Physical-device touch/audio acceptance is not claimed.

## Deployment

Store-only release: `/data/utxoplay/releases/20261024-store-0.15.0`, image `utxoplay:0.15.0`. Back up platform SQLite before recreating only the store with Compose `--no-deps`. Native games and their persistent data mounts remain unchanged. Rollback uses the 0.14.0 release Compose file with project name `utxoplay`, recreating only `store`.

Release acceptance: public HTTPS reports store 0.15.0 and Prism 0.3.0. All 14 generated in-game WebPs and 13 cover/HTML/CSS/JS/license responses match the local release SHA-256. A fresh guest can read native state for all nine games. Store container `2a1ff932c523` is healthy. The six native containers retain their previous IDs, including arcade `c3d4c871bf96`; no game restart or data migration occurred. SQLite backup `/data/utxoplay/backups/platform-before-0.15.0.sqlite` passed `quick_check`. Browser visual acceptance was local; production acceptance used public HTTPS asset/API checks.
