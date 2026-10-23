# Neon Prospector — store 0.12.0

A cyberpunk Gold Miner expedition joins UTXOPlay. Swing and cast a mechanical claw, haul six kinds of ore through 20 deterministic sectors across four districts, and buy upgrades with credits earned by playing. The store card and the game header retain the owner's Myelin logo and tag. Every control, help view, shop, restart confirmation, quality setting and audio switch lives inside the game viewport.

## Rules and economy

The 30 Hz integer simulation runs in both browser prediction and the native Myelin executor. Each 60-second sector has a target of 350 + 30 × (sector − 1). The claw catches the first intersected ore; its weight determines retrieval speed. Gold yields 80/200 score, crystals 260, scrap 15, power cells 110 plus three seconds, and data caches 90–240. Delivered ore awards floor(value / 10) credits; clearing a sector awards 15 once. Crystals gain 20% per lens tier. Fixed seeds and input replay do not establish human play or real-time pacing.

The Item Store offers EMP charges (8 credits), 15-second overdrive (18), 10-second time cells (15), and three permanent crystal lens tiers (30/60/90). Consumable stock is capped at three. EMP consumes only while hauling an object and destroys it without a reward. Overdrive consumes only while inactive. Time cells have two uses per sector and the timer caps at 80 seconds. Held controls trigger once per press. All stock, earnings, spending, upgrades and purchases are signed state. Coins are game-only and have no redemption or wallet-payment function.

Three expedition recovery charges restart a timed-out sector's clock, preserving already collected ore, score and earnings. They cannot respawn an ore reward. A new expedition explicitly resets the whole campaign. A completion result waits for the final input tail to save before the next sector becomes available.

The browser queues at most 60 unsent samples and pauses when that bound is reached. Opening the menu pauses and flushes before spending. Duplicate clicks are blocked. An uncertain response triggers a confirmed-state read; if it also fails, play and spending remain blocked until reconnect. Purchases are never automatically resent. At most the unconfirmed tail can be lost on a disconnect.

## Runtime

`games/neon-miner` reuses the existing arcade session transport as a separate application and executable, pinned to Myelin v0.31.0 commit `c0ac291c03ed8996e62834cb3f480e1ce8dc09a2`, Rust 1.97.1. The source and lock fingerprint bind its rules and state format. The private service listens on 8786 and receives authenticated account identity only from the store gateway. Exact session id and prior head bind every accepted action. Purchases accept an item identifier only; price, quantity, score and balance injection fail closed.

This is authority-signed off-chain host execution/replay. It does not claim CKB script execution, L1 publication or settlement. The matching executable independently checks exported signatures and reexecutes all transitions.

## Verification

```sh
npm test
npm run build
cargo +1.97.1 fmt --manifest-path games/neon-miner/Cargo.toml --check
cargo +1.97.1 test --locked --manifest-path games/neon-miner/Cargo.toml
cargo +1.97.1 clippy --locked --manifest-path games/neon-miner/Cargo.toml --all-targets -- -D warnings
MINER_BIN=deploy/bin/myelin-neon-miner node tests/miner-conformance.mjs
node tests/miner-platform.mjs
# Separate terminal, while the isolated validation host is running:
ARCADE_TEST_MODULES=/tmp/utxoplay-render-check/node_modules node tests/miner-flow.mjs
MINER_BIN=deploy/bin/myelin-neon-miner node tests/live-miner.mjs
```

The optional DOM harness uses jsdom and @napi-rs/canvas installed outside production dependencies. It executes the actual frontend against the real runtime, including lost committed purchase responses, failed recovery and reconnect. Browser verification separately checks the visible cover, mining, earned credits, purchase, pause and responsive layout. Device-size browser checks do not substitute for physical touchscreen/audio acceptance.

## Deployment and rollback

Only the store advances to `utxoplay:0.12.0`; a new `miner` service uses the same image and `/data/utxoplay/shared/neon-miner`. All other game images and data mounts stay as before. The miner is constrained to 384 MiB and 0.75 CPU, with no public runtime port. Build the binary in the existing Debian Bookworm arcade builder and copy it to `deploy/bin/myelin-neon-miner` before building `deploy/Dockerfile`.

Keep the matching executable, sources and Cargo.lock with the release. Back up the platform SQLite DB using its backup API. Start and health-check `miner` before replacing `store`. To revert, recreate only the previous release's store service with project name `utxoplay`; stop the unused miner service and retain its data. No old session profiles, binaries or historical records are rewritten.

Native binary SHA-256: `3eb44ab88156fc7c3b9e67966f4e0ad46ad1b683c990b57865800cbf5fa29870`.

## Release results — 2026-10-24

- 52 Node tests; seven locked Rust tests; strict Clippy and rustfmt; production build passed.
- 40 full-state conformance tapes (96,000 supplied samples) and two complete 20-sector campaigns agree between browser prediction and the portable native binary. The no-purchase campaign finishes with all three recovery charges intact.
- Actual UI/native runtime checks passed: earned coins, a double-clicked purchase, committed response loss plus failed recovery/reconnect, menu keyboard isolation, next sector, pause/resume, item use, replay, reset cancellation and blur.
- Local browser: cover/logo, a gold haul, a 20-credit balance followed by an 18-credit overdrive purchase, menu, music toggle, low-power rendering, and 390 × 844 / 844 × 390 CSS viewport bounds checked. No script errors were reported. The browser's public HTTPS navigation timed out, so no claim of a production visual acceptance test or physical-device audio/touch testing is made.
- Public HTTPS: new assets and catalog verified, then all 20 sectors completed with five purchases and 126 authority-signed frames. Downloaded evidence passes independent offline verification with the deployed portable binary. A second account remains isolated; stale/forged requests are rejected.
- Deployment: `/data/utxoplay/releases/20261024-store-0.12.0`; `store` and `miner` healthy. Initial miner memory approximately 123 MiB. Other game containers were not recreated. Platform backup: `/data/utxoplay/backups/platform-before-0.12.0.sqlite`.
