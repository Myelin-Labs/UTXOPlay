# Four signature mechanics — Store 0.23.0

These games now make different decisions central to play. They retain their own artwork and all controls remain inside the full-viewport scene.

| Game | Player decision | Cost and counterplay |
| --- | --- | --- |
| Prism Breaker | Q / E refracts every active ball upward toward the chosen side. Use it to redirect a return or rescue a falling ball. | Four of six charge, one charge per destroyed crystal. Release before another activation. Existing 24 sectors, capsules and perk drafts remain. |
| Neon Coil | Grow to at least nine segments, connect back to a distant segment and enclose a whole grid tile. | Flood-filled area scores 40 + 10 per tile, then burns the coil to three segments. Short knots, walls and zero-area crossings still kill. Gold segments indicate eligible connection points, not a solved route. |
| Starfall | Hold W / CAPTURE to absorb, then release to return a spreading volley of up to six shots. | Guns stop during capture. Reflected hits score 40 rather than 20. Holding for 45 ticks overheats the shield for 60 ticks; movement remains available. |
| Drift Run | Changing lanes leaves a 20-tick echo in the lane just vacated. Position it over rings while choosing the next lane. | Echo rings score 40 and charge energy; adjacent barrier passes give one charge once. Spend three charge on a 45-tick Overdrive that destroys barriers and increases road speed. Holding cannot auto-spend repeatedly. |

Simulation runs at 30 Hz. Ability inputs travel through the same authenticated, signed action tape as movement. Browser prediction and native execution carry identical charge, latch, timer and achievement-counter fields. Brief ability taps are buffered until one simulation tick, then consumed; pausing clears buffered input. No client score or energy grant is accepted by the host.

## Profile and save boundary

Both native application profiles bind the exact rules source and existing session/schema dependencies. New rules start fresh runs and device-best namespaces. The deployment uses `/data/utxoplay/shared/arcade-signatures` and `/data/utxoplay/shared/prism-refraction`. Prior directories `/data/utxoplay/shared/arcade` and `/data/utxoplay/shared/prism-crystal-campaign`, their authority keys and records, and images `utxoplay:0.7.0` and `utxoplay:0.17.0` are retained for archive verification. Existing wallet accounts, library, reviews and other games are retained.

An old exported genesis verifies with its matching prior executable and is rejected by the new executable for both applications. There is no migration, dual reader or attempt to reinterpret earlier signed saves. Myelin evidence remains off-chain host replay, not CKB settlement.

## Validation

- 111 Node tests; production build.
- Native locked tests: arcade 9, Prism 5, including signed recovery and tamper rejection. Clippy with warnings denied and formatting checks pass for both crates.
- 144 full-state conformance tapes (259,200 input ticks), plus four tapes that actually reach each signature mechanic from genesis.
- Isolated HTTP acceptance: every action batch agrees with browser prediction; mechanics persist; signed replay and exported offline verification pass for all four games.
- Actual app/controller harness: countdown input, pause, restart/cancel, duplicate clicks, in-flight saves, blur, disconnect recovery, single-click reconnect; Prism additionally exercises a pointer-down/up ability tap before the next simulation frame.
- Browser layout inspection at CSS sizes 1920×1080, 2560×1080, 2560×1440, 390×844 and 844×390. The in-app viewport tool caps width at 4096 device pixels (2925 CSS pixels at its current scaling); 3840×2160 geometry and backing-buffer limits remain covered by viewport unit tests, not a claimed 4K browser screenshot. Physical touch-device acceptance is not claimed.

Native portable artifacts (Debian Bookworm, Rust 1.97.1):

- `myelin-arcade`: `95233d9b98b2ed30938f83750f0a924e90f121bef2d23e484d651dd4f9313e15`
- `myelin-prism-breaker`: `847dc361e27a904992f0a0fd42757e5d0c07b6d16932151e7c56dc9a52b51261`

## Rollout

Release directory: `/data/utxoplay/releases/20261024-store-0.23.0`. Back up platform SQLite before rollout and archive the stopped old native data directories. Recreate only `store`, `arcade`, and `prism`, using image `utxoplay:0.23.0`. Verify public health, exact served resources, native hashes and real signed signature sessions. Other runtime containers must keep their IDs.

Rollback uses the 0.22.0 Compose file for these same three services, which restores the old native images and their old data mounts. Keep the new profile directories as well; do not overwrite either profile's evidence. The platform database schema is unchanged.

Rollout completed on 2026-10-24 from implementation revision `53987f45cd3cda2f9feb285d55f529e83f8e2cec`. Public HTTPS reports Store 0.23.0. All ten changed HTML/module/style responses match local SHA-256 hashes. Each of the four signature tapes also passed through the public store gateway, persisted every batch, replayed with the same state root, and verified offline with the portable executable. Native hashes match the artifacts above. Health reporting now reads package.json instead of a separately maintained literal.

The platform SQLite backup passed `quick_check`. Root-only archive backups are `arcade-before-signatures.tar.gz` and `prism-before-refraction.tar.gz`; the original directories remain in place. OpenStrike, miner, sling, Teeworlds and chess container IDs were unchanged. Browser inspection used the identical local release; public release acceptance used HTTPS assets and signed runtime APIs.
