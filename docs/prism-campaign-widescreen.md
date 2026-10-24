# Crystal campaign and display adaptation — store 0.17.0

Prism Breaker's previous rules refilled the same 48 positions after each wave. The new campaign has 24 authored and occupancy-distinct 12×8 formations: spires, chevrons, diamond, ring, stairs, gate, maze, constellations, citadel, hourglass and others. Later sectors add armour; explosive crystals damage adjacent cells without wrapping rows, and supply crystals guarantee capsules. Falling formations exert bounded pressure after 30 seconds. A sector ends in a paused, three-option perk draft (fewer offers only when nearly all upgrades are maxed).

Six capsules: widened paddle, time dilation, triple orb, one-use floor shield, piercing phase orb, instant pulse recharge. Effects last 12 seconds before upgrades. Space / the in-scene Pulse button damages up to three crystals in a column, with a 12-second cooldown. Six four-rank permanent perk families modify paddle width, armour damage, pickup reach, effect duration, combo cap and per-sector shields. Campaign cap: 24 sectors / 60 minutes. All inputs and perk choices are executed and replayed by the authority; the browser never supplies rewards or resulting state.

## Persistence and deployment

The old arcade executor commits its whole rules source into every game profile. Rebuilding it would invalidate the three unchanged games' recovery profiles. Accordingly Prism has its own crate and runtime, `myelin-prism-breaker` 0.1.0, built with locked Myelin v0.31.0 revision `c0ac291c03ed8996e62834cb3f480e1ce8dc09a2` and Rust 1.97.1. The profile includes the exact authored JSON as well as game/session source and Cargo.lock. `PRISM_URL` defaults to port 8787.

Production data: `/data/utxoplay/shared/prism-crystal-campaign`. This is a new campaign, not a conversion of old signed saves. Previous Prism records remain in `/data/utxoplay/shared/arcade` with the original running arcade binary. No existing native game image or data directory is replaced. Store image advances to `utxoplay:0.17.0`; only the store and new Prism container are created/recreated. Rollback: run the previous release's compose file for `store` alone, and stop the new `prism` service. Keep both data directories.

Evidence is authority-signed off-chain host replay. It is not CKB execution, settlement or a public court.

## Display implementation

All nine games load `widescreen.css`. Every button, item bar, store and menu remains in the game viewport. Canvas games cover the entire surface. Rendering and pointer mapping share isotropic transforms; square grid / chess rules retain geometry, while the environment uses the surrounding screen. Prism uses a wide 1000×625 play space. Skyward's background is anchored to the playable ground so no inset second picture appears. Teeworlds camera magnification follows screen height; its aiming uses the same zoom. OpenStrike retains its perspective aspect update and now caps backing resolution on resize. Large-monitor HUDs scale up to 2×; canvas / WebGL budgets cap at 8,294,400 pixels, with existing adaptive lower quality preserved.

## Validation

- Node suite: 72 tests, including unique sector occupancy, all capsule mechanics, draft freeze / invalid choices, explosion boundaries, time-limit draft handling, and inverse transforms at 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844, 844×390.
- Native crate: four tests, including signed recovery, offline replay, stale request rejection and tamper rejection; locked build, fmt and clippy.
- 144 shared arcade conformance tapes / 259,200 input samples. The three unchanged arcade games still match their unchanged native binary.
- 48 additional Prism random/control tapes, plus a legal controller completing all 24 sectors in 29,131 ticks with 23 perk choices. Full browser/Rust state equality.
- Complete campaign through a disposable native service: 520 signed frames, replay, offline export verification, account isolation, rejected stale/forged actions, exact state after restart.
- Actual application DOM/native flow: start/countdown, pause, restart cancellation, delayed requests, blur, reconnect; perk selection after a legally cleared sector, one request for repeated clicks, paused draft and recovery after a lost acknowledgement.
- All nine game's controls remain inside their game-owned surface in the DOM harness. Browser inspection covers wide scenes, 4K HUD scale and phone regressions. Multiplayer lobby presentation uses an explicitly marked transport fixture locally; no multiplayer match correctness is claimed from that fixture.
- Three shared arcade renderers pass six display sizes, exact pixel-budget checks, full-scene coverage, unchanged rule state, idle/effect invalidation and observer-based resizing without per-frame layout reads.
- Generated-art Canvas renderer: effect limits, idle invalidation, quality/motion changes, resize and output image. CPU render median approximately 1 ms at 1920×1080 in the native Canvas harness; this is not a browser FPS claim.

Reproduce: `npm test`; `node tests/prism-campaign-conformance.mjs`; `node tests/prism-signed-campaign.mjs`; set `ARCADE_TEST_MODULES` to an external jsdom / @napi-rs/canvas installation for DOM/render scripts. Native build command follows `deploy/ArcadeBuilder.Containerfile` with manifest `games/prism-breaker/Cargo.toml`. The signed campaign script uses a temporary data directory and never production saves.

## Published verification — 2026-10-24

Published release `/data/utxoplay/releases/20261024-store-0.17.0`. Store and Prism health checks pass. The six pre-existing native containers retain their exact container IDs. Platform SQLite received a verified, consistent backup before release.

Public HTTPS health reports 0.17.0 and Prism catalog reports 0.4.0. All nine native state endpoints return 200. Twenty-two public HTML/CSS/module responses match the local release SHA-256. A legal first-sector clear and perk selection through the public gateway produced 20 signed frames and advanced to sector two; public replay and local offline export verification both passed. Native binary SHA-256: `d8c95bc7605ff5612fc7863f74cf6bd854bcd436b4d39174e7f2a65dcf8aa3a9`.
