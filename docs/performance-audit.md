# UTXOPlay 0.6.0 performance audit

Date: 2026-10-23. Scope: storefront, publisher/checkout loading, four first-party browser clients, and static/API delivery. Native engines, simulation frequencies, state roots, replay formats, wallet ownership verification and payment settlement rules are unchanged.

## Measured assets

Build comparison against Store 0.5.0 (`6e29089`), using the Vite manifest's entry and recursive static imports. Dynamically imported wallet and commerce code is excluded from the initial graph, but still downloaded when requested. Sizes are bytes, not timings.

| Payload | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Initial JavaScript, raw | 1,197,393 | 390,235 | 67.4% |
| Initial JavaScript, gzip | 384,822 | 124,496 | 67.6% |
| Four chess/Skyward raster assets | 7,599,292 | 5,433,846 | 28.5% |

The current initial bundle is 116,560 bytes with Brotli. `node tools/performance-report.mjs` reproduces the JS totals after `npm run build`. The image conversion is lossless WebP; decoded RGBA pixels were compared with the retained PNG originals. Credits and originals are preserved.

## Store and delivery

- Wallet providers initialize only when the player chooses a wallet. The App remains mounted, preserving the current route, guest identity and game frame. Loading feedback, cancellation and a load timeout are provided.
- Publisher, purchases and vendor launch UI load on route entry. Transaction utilities load when actually needed. Shared store filter CSS stays in the initial stylesheet; six genres wrap into a usable three-column grid on narrow screens.
- Builds generate Brotli and gzip sidecars ahead of time, with no per-request compression cost. Negotiation respects quality values and explicit exclusions; original MIME types and `Vary: Accept-Encoding` are preserved. Range requests use the original representation.
- Hashed JS/CSS receive a one-year immutable policy. Stable game script URLs revalidate, allowing prompt updates. Images and audio cache for one hour; HTML revalidates. API responses remain `no-store`.
- High-frequency session lookups reuse a prepared SQLite statement, including WebSocket revocation checks on each message. Rate-limit updates use one prepared atomic upsert instead of a delete plus insert; expiry and persistent quotas are preserved.
- Background chess/Skyward state reads update the library timestamp at most once per minute. Actual actions still update it immediately. Client polls wait for completion, pause while hidden, and discard responses that became stale during a user action.

## Games

- **The Quiet Board:** preserve the 64 square elements and update changed piece content only; delegated clicks avoid rebinding listeners. Selection retains focus. Legal move, promotion, review and flip logic remains intact.
- **Skyward:** pre-scale static scenery once; reuse it during flight. Render at up to 60 Hz during interaction, 30 Hz while idle, and stop animation callbacks in hidden documents. The scheduler preserves frame cadence on high-refresh displays. Existing hidden-tab flight timing continues to pause the visual replay.
- **Teeworlds:** cache static terrain in at most 32 padded 512-pixel chunks, rather than rebuilding tile paths every frame. This bounds the terrain canvas storage to approximately 34 MiB before browser overhead. Deduplicate HUD text; cap rendering at 60 Hz and pause it while hidden. Input timers and the native 50 Hz simulation retain their original frequencies; hidden controls are released. Collision constraints and motion interpolation are unchanged.
- **OpenStrike:** instance static boxes by material and merge obstacle edges; reuse per-frame vectors. Deduplicate ammo/HUD changes and separate visual prediction from input sequence increments. Bound outbound socket buffering. Active rendering targets up to 120 Hz, menus 30 Hz, and hidden rendering stops; native 64 Hz ticks remain unchanged.
- **Graphics preferences:** adaptive mode adjusts Teeworlds/OpenStrike resolution only after sustained load, with delayed recovery to avoid oscillation. High detail and performance presets override it. Settings persist per browser and propagate to open same-origin game frames. Resolution changes never alter collision or replay data.

A local browser sample showed 9 draw calls per OpenStrike lobby frame (30 FPS; approximately 0.27 ms CPU submission), and approximately 0.20 ms CPU rendering per Teeworlds frame. These are diagnostic samples on one desktop, not before/after GPU timings or universal FPS guarantees. CPU submission time excludes asynchronous GPU execution and network latency.

## Validation

- 36 automated tests pass, including signatures, account isolation, marketplace contracts, motion constraints, persistent rate quotas, library write coalescing, compression negotiation, ETags, ranges, adaptive resolution hysteresis, 144 Hz scheduling, visibility pause/resume and non-overlapping polling.
- Browser: wallet chooser opens and cancels; Studio loads; chess e2–e4 preserves the destination focus and renders pieces; Skyward launches with the lossless art; Teeworlds practice renders terrain and characters; OpenStrike practice renders the arena, opponent and weapon, ending in a verified replay. Game start still enters immersive mode.
- Real local runtimes: chess/Skyward legal actions, stale rejection, replay and export; CKB challenge/login/logout/save recovery; OpenStrike authenticated two-account WebSocket duel and verified export; full Teeworlds 60-second duel and verified shared export. Disposable accounts were used; no funds or chain transactions were involved.
- Repeated guest testing hit the existing daily quota on the development database. Guest smoke tests were moved to an isolated temporary Store database with the same real game services, without clearing or weakening the actual quota.
- Narrow-screen review at 390×844 found and corrected genre-filter overflow. Hardware touch performance and slow mobile networks have not been benchmarked.

## Release procedure

Build before packaging so precompressed assets are included. Preserve the previous release's hashed `dist/assets` files in the new deployment to let existing tabs load their deferred chunks. Back up SQLite consistently, build the new Store image, smoke-test it independently, then recreate only Store. Keep the four native runtime images, containers and persistent stores unchanged. Reverting the Store image does not require a schema rollback.

Production acceptance results are recorded below after deployment. Paid publishing remains unavailable until the operator configures a real Store CKB receipt address; this performance release does not activate payments.

### Production acceptance

- `https://store.utxoplay.io/api/health` reports 0.6.0 and Docker reports healthy. All four catalog games remain present.
- Public HTTPS serves the entry bundle and all four game clients with Brotli. The initial bundle transfers 116,560 encoded bytes; its hashed URL is immutable. Stable game scripts return `no-cache`. The previous 0.5.0 entry remains available as JavaScript for old tabs.
- Public CKB cryptographic login, replayed-nonce rejection, logout revocation and wallet save recovery passed. Public OpenStrike authenticated duel, kill and Myelin export passed. Public chess/Skyward legal actions, stale action rejection, isolated state, verified replay and exports passed using disposable unfunded wallet accounts (`SMOKE_AUTH=wallet`).
- Native game image IDs and container start timestamps were identical before and after rollout. A consistent pre-release SQLite backup was made; only Store was recreated.
- The in-app browser timed out on the public URL. Visual interaction acceptance was therefore local; production acceptance used HTTPS/API/WebSocket checks. No claim of public-browser Lighthouse or mobile-device benchmarking is made.
