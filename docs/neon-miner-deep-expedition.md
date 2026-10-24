# Deep Expedition — Neon Prospector 0.2.0 / store 0.16.0

The campaign now has 60 sectors across four districts. Five contracts repeat with progressively harder conditions: value run, crystal survey, salvage order, power relay and vault breach. Clearing requires both the value target and the specified collection count. Sector seeds, movement, armor, collections, score, spending and inventory are executed by the native Myelin application and identically predicted in the browser.

## Rules

Twenty objects replace the old fifteen-object field. From sector 11, selected ore drifts deterministically. Volatile mines drain 4/5/6/7 seconds by district when delivered, give no reward, and can be discarded safely with EMP. Their count increases from one to three. Armored vaults require one cracking hit in the first two districts and two in the last two before they can be collected. Armor damage persists across recovery. Contracts in the last two districts require three crystals, three scrap deliveries or two armored vaults; power relays require two cells from district two onward.

The clock decreases from 60 seconds to a floor of 35. Sector 31 onward doubles swing speed and allows only one time cell per sector instead of two. The base target is `380 + 32*(sector-1) + 100*district`, scaled by contract (100%, 85%, 65%, 85%, 85%). A chain of consecutive deliveries increases value by 5% per prior delivery, capped at 25%; a miss, armor-only return, discarded cargo or mine breaks it. Completion credits are 20/25/30/35 by district. Consumable prices scale by `1 + district²`; buying is still exclusively with earned, non-redeemable in-game credits.

Stasis (F) freezes moving ore and slows aiming for six seconds. Winch tuning adds four units to the retrieval numerator per tier (three tiers), helping especially with heavy salvage and vaults. The existing EMP, overdrive, time cell and crystal lens remain. Held controls consume items only once per press; unavailable tools cannot consume stock. Recovery preserves collected ore, armor, contract counts and earnings; it cannot farm duplicate rewards. EMP cannot discard an object if it would leave too few remaining objects to complete the contract.

## Game-owned controls

The Canvas fills the complete game viewport and paints a continuous mine environment. Header, HUD, contract, scan, item-store button, equipment buttons, cast button, pause/result overlays and dialog are all children of that same field. There are no controls in an outer dock or frame. The header, HUD and equipment layout now overlay the mine image. Gameplay objects preserve their aspect ratio, and controls reserve readable space without changing authoritative hit coordinates. Scan now replays the actual future cast on a copy, so drifting targets and armor are forecast accurately.

## Evidence and persistence

This is a new application profile and state schema. The previous 20-sector profiles must never be reinterpreted by the new rules. The release uses `/data/utxoplay/shared/neon-miner-deep-expedition` for new expeditions. The previous `/data/utxoplay/shared/neon-miner` directory, its authority keys, session records and the exact old executable/release remain intact for archive verification and rollback. The new campaign starts with a fresh rig and balance; it does not transfer unverified balances from the old rules. The help and release notes disclose this boundary. No dual schema reader, legacy runtime branch or fabricated migration receipt is introduced.

Myelin remains off-chain authority-signed host execution/replay, without CKB settlement or redeemable-token claims.

## Validation

- 65 Node tests, including all 71 cast angles across 60 sectors (4,260 contact comparisons), mission requirements, late timing/tool prices, stasis and winch behavior.
- Nine locked Rust tests, strict Clippy, rustfmt and production build.
- Portable Debian binary: `3ac9e942569438c6ae643ccf0997b5945326d4dede2f91ae49627af69760260c`.
- 64 random/held-control tapes (153,600 supplied samples) and two complete 60-sector campaigns match Rust/browser state exactly. The equipped baseline finishes with three recoveries intact; the route using stasis also completes, exercising recovery. Automated route planning is a reachability/balance check, not a human difficulty rating.
- A complete native signed campaign: 795 frames, exact prediction after every accepted action, stale and forged write rejection, separate-account isolation, offline export verification and restart recovery. Evidence recorded locally in `/tmp/miner-deep-signed-CX8ep8/expedition.json`.
- Actual app/native gateway harness: image failure/retry, scanner, in-field control ownership, earnings, duplicate purchase, committed-response loss and reconnect, menu key isolation, next sector, pause/resume, item consumption, replay, restart cancellation and blur.
- Browser visual/layout checks: desktop, 390×844 and 844×390; all visible gameplay controls lie inside the Canvas rectangle. The Item Store scrolls inside the game dialog. No physical-device touch/audio acceptance is claimed.

## Deployment / rollback

Build the portable executable in `deploy/ArcadeBuilder.Containerfile`, then build store image `utxoplay:0.16.0`. Back up platform SQLite and retain a stopped copy of the old miner data before replacement. Recreate only `miner` and `store`; all other game containers/data remain unchanged. Rollback uses the 0.15.0 Compose file, restoring the old miner image and its original data mount together with the old store. Preserve new expedition data as well.

Release completed at `/data/utxoplay/releases/20261024-store-0.16.0`. Store `d0ab03d61128` and miner `8015e934c159` are healthy, and the deployed miner executable matches the hash above. Other game container IDs are unchanged. Public HTTPS confirms store 0.16.0, miner catalog 0.2.0, exact SHA-256 equality for all seven changed UI/rules resources, and successful state requests for all nine games. The public gateway completed three sectors, six purchases and 20 signed frames; its exported evidence passed offline verification (`/tmp/miner-public-evidence-BHtzlj/session.json`). Full 60-sector acceptance was performed against the isolated authority, not by consuming a full public campaign.

The old miner directory remains untouched at its original path. Its stopped, consistent backup is `/data/utxoplay/backups/neon-miner-before-deep-expedition.tar.gz` (root-only), alongside the SQLite backup `/data/utxoplay/backups/platform-before-0.16.0.sqlite`, which passed `quick_check`. Public browser navigation was not used for visual acceptance; desktop/mobile visual checks used the identical local release and production checks used public HTTPS APIs/assets.
