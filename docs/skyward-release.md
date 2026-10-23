# Skyward expanded gardens — store 0.9.0

Skyward now has twelve authored islands in four regions. The first three retain their layouts; the next nine introduce separated towers, stone gates, elevated gardens and mixed-height clusters. All twelve can be cleared within the four normal shots without items. Chapter names, total count and region come from the authoritative game view. The UI includes a journey bar and chapter lighting using the existing artwork.

Every island supplies one bloom bomb, one star feather and one extra flight. Choose bomb or feather before a launch. Bombs deal two direct damage and clear live targets within 100 world pixels of the first collision. Feathers deal two damage and retain their velocity through targets. Extra flight is a separate accepted action and can rescue a failed island before retrying. Invalid actions consume neither shots nor inventory. Retry restores the island's starting score and inventory; next island refills inventory. Last-flight playback consumes nothing. Inventory and the last shot's power are part of the signed state and deterministic host replay.

The existing credited “Carefree” recording is now enabled on the first user gesture, subject to browser playback permission. Nothing autoplays on page load. Mute and volume are remembered; the volume controls music and synthesized effects. Hidden documents pause music and suspend the audio context. A playback failure leaves an explicit Play music button to retry. The recording is unchanged (205 seconds, MP3, 44.1 kHz), with its original attribution in ASSETS.md and the credits dialog.

## Validation

- 51 Node tests, including music activation, persisted mute/volume, blocked-playback retry and hidden-document suspension.
- Nine Rust tests with locked dependencies: deterministic rules, all twelve islands winnable without items, unique in-bounds layouts, atomic inventory consumption, actual bomb/piercing effects, snapshots, signed recovery, replay and tamper rejection.
- Strict Clippy on all Skyward targets; game rules formatted with rustfmt.
- Production web build and native Debian Bookworm build.
- `tests/skyward-flow.mjs`: real app module in jsdom, actual native Canvas rasterization and the real signed runtime. Covers selected items, extra shots, failed requests, double-click guarding, flight replay, verified replay, next island, last-shot rescue and retry.
- `tests/live-skyward.mjs` with `tests/skyward-solutions.json`: all twelve islands through the store API (33 accepted actions), then a separate item session (three accepted actions), stale input rejection, final-campaign boundary, depleted-item rejection and offline verification of both exports.
- Browser preview timed out. Canvas/UI automation and HTTP checks do not establish audible playback or touch layout on every physical device.

Optional integration dependencies are jsdom and @napi-rs/canvas outside the production package. Set ARCADE_TEST_MODULES to their node_modules directory, STORE_URL to the isolated store, and SKYWARD_BIN to the matching native verifier.

## Deployment and saved records

Both store and Skyward use `utxoplay:0.9.0`. Other runtime images stay unchanged. This changes Skyward's application profile (game.rs/session.rs/Cargo.lock fingerprint); old signed sessions must never be reopened with changed rules. The expanded campaign uses `/data/utxoplay/shared/sling-gardens`. The original `/data/utxoplay/shared/sling`, old `utxoplay:0.1.0` runtime image and previous release remain untouched for archival verification and rollback. Existing players begin a fresh campaign; the in-game save panel says so. There is no automatic conversion or legacy decoder.

Build the portable binary with deploy/ArcadeBuilder.Containerfile (Rust 1.97.1, Debian Bookworm), using `cargo build --locked --manifest-path games/sling/Cargo.toml`. Copy it to deploy/bin/myelin-sling before building deploy/Dockerfile. Native binary SHA-256: `8519ca0a5b7b7c9cfe907926b4e1cbd2022639c664486d177409fbb10822c769`. Keep the exact source, lockfile, binary and previous compose file with the release. Rollback uses the prior store image and the original Skyward image/data mount together.

This remains an off-chain authority-signed Myelin session with host replay. It does not establish CKB settlement, script verification or on-chain adjudication. Myelin logo/tag is present in both the game header and the shared shell.
