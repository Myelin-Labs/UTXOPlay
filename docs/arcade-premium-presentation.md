# Arcade presentation — Store 0.24.0

This release replaces the in-game presentation of Prism Breaker, Neon Coil, Starfall and Drift Run. The 0.23.0 rules, application profiles, native executors and signed-save directories remain unchanged.

## Worlds and assets

| Game | Environment | Playable objects and feedback |
| --- | --- | --- |
| Prism Breaker | A glass-vaulted optical observatory, reflective stone floor and six restrained chapter lighting treatments | Six jewel materials, machined gold paddle, opal ball, lens, heart, shards, crystal impact. Perk cards and HUD use matching exported atlas sprites. Existing 24 layouts and refraction remain. |
| Neon Coil | Dark ceramic, copper circuits and a miniature botanical conservatory | Articulated celadon serpent with directional head/tail, copper joints, amber seed and gold circuit nodes. Legal connection segments retain their distinct gold treatment. |
| Starfall | A planetary limb under an orbital station and nebula | Ivory interceptor, three enemy hulls, visible thrusters, capture reactor, stored-energy lights and explosion sprites. Hull appearance is stable when other enemies die. |
| Drift Run | Wet coastal highway, amber skyline and reflective water | Rear-view ivory supercar with steering poses, echo car, copper barriers, rings, illuminated roadside bollards and Overdrive trails. Translucent road layers preserve the actual wet material. |

Eight original 1536×1024 ImageGen PNGs contain four environments and 30 sprites. The preserved RGBA atlases have real transparency. Delivery uses WebP (background quality 88, atlas 94), approximately 0.9–1.1 MB for each game's environment and atlas. No model-generated text is used for interface copy.

Full prompts, original paths and runtime paths are recorded in [arcade-premium-art.json](arcade-premium-art.json). Rebuild delivery images and seven small Prism interface icons with `ART_TOOL_MODULES=/path/to/node_modules node tools/build-premium-art.mjs`, using optional `@napi-rs/canvas`. Sprite bounds are explicit in `games/arcade/web/premium-art.mjs`; images are sampled directly without per-frame cropping, filters or uploads.

## References and licensing

- Drift Run's perspective quadrilateral/shoulder construction adapts `Render.segment` from [Jake Gordon's JavaScript Racer](https://github.com/jakesgordon/javascript-racer/blob/3e8a060b5900755db27f899612a74a77427c853e/common.js). Its MIT notice is distributed at `/arcade/licenses/javascript-racer.txt`. Racer's third-party OutRun graphics and audio are not imported. UTXOPlay's existing `roadPoint` continues to determine all on-screen collision positions.
- Prism retains its earlier licensed [JavaScript Breakout](https://github.com/jakesgordon/javascript-breakout) focus-lens reference; this release changes presentation, not interception or physics.
- [SpaceShooter](https://github.com/MichalGoly/SpaceShooter) was reviewed for sprite-based ship/effect separation. Its README distinguishes CC0 Kenney assets from CC BY explosion assets. No code, sprites or audio from that project are distributed here.
- [Snake-Game](https://github.com/dododora/Snake-Game) was reviewed for material/lighting presentation. No code or assets were imported. These smaller examples are not represented as production-quality engines.

## Runtime and loading

Every game now waits for decoded environment, atlas and cover before enabling play. Progress reports actual completed image decodes. A failed image triggers the existing recoverable asset-error screen; late responses from the failed attempt cannot advance a later attempt's progress. Existing pause, restart and recovery behavior stays in place.

Static full-viewport scenery is cached per size/quality. Particles, impact rings and labels remain bounded. Low-power mode removes radial glow; reduced motion freezes ambient animation. Idle scenes stop redrawing once transient effects settle. Backing buffers retain the existing 8.29 million pixel cap. Logical board geometry and inverse pointer transforms are unchanged; artwork extends into the surrounding viewport. All controls and overlays remain children of the game scene.

## Validation

- 114 Node tests, including decode gating, failure and successful retry for all four asset packs; production build.
- Actual native Canvas renders at 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844 and 844×390. Checks include full opaque coverage, pixel cap, state immutability, resize, reduced-motion and idle invalidation. All four output scenes were visually reviewed.
- Real native executors plus actual app/controller harness: all four games pass countdown input, pause/menu, restart/cancel, duplicate-click protection, blur, dropped save, reconnect and signed replay.
- Native Canvas CPU microbenchmarks with actual decoded assets, not browser FPS: at 600×600 CSS with 2× backing, P95 was 2.439 ms for an 80-segment Coil, 1.011 ms for Starfall and 0.505 ms for Drift. Prism at 1920×1080/1× backing measured 2.343 ms P95. These are local measurements, not guarantees for every device.
- Browser UI checks use the same local release. The in-app browser's screenshot capture scales content incorrectly under explicit viewport overrides; DOM geometry confirms actual CSS size and scene ownership. True 4K is covered by native Canvas and viewport tests, not a claimed 4K browser screenshot.

## Rollout

Publish `utxoplay:0.24.0` to `/data/utxoplay/releases/20261024-store-0.24.0` and recreate **store only**. Native arcade and Prism remain on `utxoplay:0.23.0` with their existing profile data. Back up platform SQLite first. Preserve other game containers and old hashed web chunks. Verify served compressed modules, HTML, CSS and every new WebP against local SHA-256; verify persisted native replays without changing saved states.

Rollback: recreate only store from the preceding 0.23.0 Compose file. This release does not alter the database schema or any native game state format. Myelin remains off-chain host replay, not CKB settlement.

Rollout completed on 2026-10-24 from implementation revision `bdfc44df2b51e580cedf886b13d5ed77d16d7e61`. Public HTTPS health reports 0.24.0; all 28 checked responses (four HTML entries, eight shared modules/style/license responses, Prism CSS and 15 new WebP files) exactly match local bytes. The store container is healthy. Existing native sessions replayed successfully: Coil 300 ticks, Starfall 141, Drift 308 and Prism 420. Arcade, Prism and every other game container retained its prior ID. Both native binary SHA-256 values match the 0.23.0 release. The pre-release platform SQLite backup passed `quick_check` at `/data/utxoplay/backups/before-art-0.24.0-20261024-123417/`.
