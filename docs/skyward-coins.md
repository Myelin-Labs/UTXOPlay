# Skyward coins and Item Store — 0.11.0

The Item Store opens directly from the game's coin counter. Game, Item Store, Settings and Help are flat views in one game-owned menu. Buying leaves the store open with the confirmed balance and stock; equipping an owned flight power returns to play. Extra flights are explicitly used from owned stock. Item descriptions and equipped-state feedback stay visible. Starting a new adventure requires an inline reset confirmation.

## Authoritative rules

- A sprite earns 5 coins, a support 1, and clearing an island 10. Rewards come from accepted launches, never replay or UI callbacks. A target bitmap survives retry, preventing repeated rewards for the same target. Clearing cannot be replayed as an accepted launch on a won island.
- Bloom bomb costs 12, star feather 10, and extra flight 8. Prices and eligibility come from the native game. The Buy action accepts only its item identifier; caller-supplied prices, quantities or unknown items fail closed.
- Stock is capped at three per item. Next/retry carries unused stock and replenishes empty slots to one. Coins earned/spent and current balance persist across islands/retries. New adventure resets the campaign.
- Extra flights are limited to three per attempt. Buying an extra flight adds stock; using it adds one shot. A lost island allows extra-flight purchases for rescue if the attempt limit permits. Other powers wait until retry.
- Each purchase is a single signed, pre-head-bound transition. A repeated stale request cannot debit again. Balance, cumulative earnings/spending, stock, reward bitmap and extra-flight usage are in the snapshot/state root and survive recovery and offline replay. Coins have no real-world redemption or wallet-payment function.

The UI blocks duplicate submissions and never optimistically changes balances. After an uncertain response it reads the signed state. If recovery also fails, spending and play are disabled until explicit reconnect or polling restores the current state. No purchase is automatically resent.

## Validation

- 13 locked Rust tests: price/quantity forgery, insufficient funds, stock/extra limits, retry reward farming, item consumption, snapshot validity, purchase recovery, stale purchase rejection, signed/offline replay, and twelve islands winnable without purchases.
- Strict Clippy on all Skyward targets and rustfmt with Rust 1.97.1; portable Debian Bookworm native build.
- 51 Node tests and production web build.
- All eight game DOM integrations: controls remain inside the viewport, flat menu switching, focus restoration, game-menu and native help-dialog keyboard isolation.
- All four arcade app/runtime flows pass after the shared-menu change.
- Real Skyward app + native Canvas + signed runtime: earning/buying/equipping/using, double click, response loss after a committed debit plus failed recovery/reconnect, reset cancellation, flight replay, next island and rescue.
- Full twelve-island API run (33 actions), item run (3 actions), and earned-coin purchase run (6 actions), including offline verification of exported evidence.
- Browser preview still times out. These tests are not a physical-device or pixel-level visual acceptance test.

## Deployment and archives

Store and Skyward use image `utxoplay:0.11.0`. Skyward uses `/data/utxoplay/shared/sling-coins`; its changed application profile must not open older sessions. Existing expanded-campaign records in `sling-gardens`, original records in `sling`, prior images and release sources remain preserved for archival verification and rollback. The game explicitly says the coin campaign starts fresh. No balance conversion, dual decoder or signed-history rewrite is performed.

Portable binary SHA-256: `2165ab0987fa55628561c461005b6269d9455e7ac167cfc3b8cb51316fe73ec0`.

Deploy the new runtime before the new frontend, and health-check both. Rollback uses the prior 0.10.0 release's compose file for both `sling` and `store`, restoring the `sling-gardens` mount together with its original runtime image. Keep coin data intact for investigation or reactivation. Other runtime images and data mounts do not change.

Myelin execution here is authority-signed off-chain host execution/replay. Coins and purchases do not constitute CKB settlement or on-chain assets.
