# Neon Prospector artwork release — store 0.13.0

The mine now uses original imagegen artwork throughout gameplay: four 1536×1024 environments, six transparent ore sprites, a mining drone, a mechanical claw, and four equipment icons. The same equipment assets appear in the field, dock, help and Item Store. Backgrounds are cached, images decode once, particle counts are bounded, low-power rendering removes atmospheric beams/motes, and auto quality now adjusts canvas resolution. All 16 WebP assets total about 1.9 MiB. The supplied Myelin logo remains intact.

The optional prospecting scanner forecasts the first contact using the existing discrete probe steps and collision ordering. It displays mineral value and weight, including the existing crystal-lens bonus; sealed caches retain an unknown value. Q or the in-field Scan button toggles it. Timing, purchases, rewards and signed input tapes still use the existing native game. EMP shockwaves, collection sparks, overdrive exhaust and time-cell feedback are presentation effects; they create no extra rewards.

All controls remain inside the game-owned viewport. Artwork decode failure blocks starting an invisible game and offers a retry. Existing expeditions, earned credits, stock and session profiles are unchanged. This release changes only the store image to `utxoplay:0.13.0`; the miner remains `utxoplay:0.12.0` with its existing data mount and binary hash `3eb44ab88156fc7c3b9e67966f4e0ad46ad1b683c990b57865800cbf5fa29870`.

## Provenance

`docs/neon-miner-ingame-art.json` records all six built-in imagegen prompts, generated sources and extraction/encoding parameters. Final assets are in `games/neon-miner/web/art/`. No third-party artwork or new runtime dependency was introduced. Canvas is used for rendering, typography and animated effects; generated raster artwork supplies every environment and gameplay object.

## Validation

- `npm test`: 54 passing tests, including all 71 cast angles in all 20 sectors (1,420 forecast/contact comparisons), read-only scanning, removed targets and lens valuation.
- `npm run build`: production bundle and precompressed game resources.
- `ARCADE_TEST_MODULES=/tmp/utxoplay-render-check/node_modules node tests/miner-flow.mjs`: actual app + native runtime, artwork decode failure/retry, scanner toggling, earning/spending, duplicate and uncertain purchase handling, reconnect, input isolation, pause/resume, item use, replay and blur.
- The shared game-shell harness verifies every bundled game retains its own viewport controls.
- All 16 WebP files decoded; actual renderer frames checked for sectors 1, 6, 11 and 16. Browser checks cover mining and generated Item Store assets. At 390×844 and 844×390 CSS viewports, all dock/scanner controls are within the viewport, no horizontal overflow was present, and DOM images decoded successfully. These checks are not physical-device touch/audio acceptance.

## Release / rollback

Deploy to `/data/utxoplay/releases/20261024-store-0.13.0` after a SQLite backup at `/data/utxoplay/backups/platform-before-0.13.0.sqlite`. Build the store Dockerfile, validate Compose, then recreate only `store` with `--no-deps`. No miner restart or profile migration is required. Roll back by recreating only `store` from the 0.12.0 release Compose file using the same `utxoplay` project name. Retain current game data.

Public HTTPS checks confirm store 0.13.0, all 16 WebP SHA-256 hashes and all six changed HTML/CSS/JS responses match the release. The store and miner are healthy; only the store container was recreated. Browser visual acceptance was performed locally because the in-app browser timed out navigating the public HTTPS route; public asset/runtime checks use HTTPS directly.

Public campaign validation completed all 20 sectors with five purchases and 126 authority-signed frames; the export passed independent offline verification with the unchanged deployed miner binary. Separate-account isolation and stale/forged action rejection passed in the same harness. Evidence for this run: `/tmp/miner-evidence-CZIwTi/session.json`.

## Store 0.13.1 — embedded launch hotfix

Neon Prospector's game-owned UI omitted the `utxoplay:game-ready` parent notification supplied to other games by the shared shell. Direct game URLs worked, while the store's `/play/neon-miner` iframe stayed behind its loading overlay and incorrectly displayed a network timeout after 15 seconds. The game now announces UI readiness to its same-origin parent after wiring controls, before starting asynchronous artwork/session requests, so its own loading and retry screens remain accessible.

The actual-app/native-runtime harness asserts that exactly one same-origin readiness message precedes network work, including the artwork failure/retry path. All 54 Node tests and the production build pass. Local browser validation entered through `/play/neon-miner`, launched as a guest, started mining, and still showed `game-stage is-ready` with zero loading overlays beyond the former timeout; no console errors were reported. Public HTTPS confirms store 0.13.1, route200, and exact game HTML/module contents. Public in-app-browser navigation still times out at the tooling layer, so no production visual acceptance claim is made. Only the store container was replaced; the miner container ID remains unchanged. Release: `/data/utxoplay/releases/20261024-store-0.13.1`.
