# Skyward floating gardens — Store 0.22.0

The twelve-island campaign now has four distinct illustrated environments, a consistent miniature-style cast, carved wood and limestone structures, three illustrated shop items, and new cover art. The game, loading screen, in-game menu and store catalog share the artwork; provenance and exact generation prompts are in `games/sling/ASSETS.md`.

Every control remains inside the full-viewport game surface. Cream, teal and gold controls replace the old generic strip; a region ribbon, flight medals and concise result statistics make progression visible. Wide screens extend the scenery without stretching collision geometry. Phone landscape reserves less space above and below the playfield. The menu dims and blurs the scene, pauses local playback and resumes without a time jump. A short fading guide avoids revealing the complete shot.

Input owns one pointer until release or cancellation. Taps, other fingers, capture loss, blur and menu opening cannot accidentally spend a flight. The pull radius now uses the native legal maximum of 120 (previously 119), so valid near-maximum pulls are no longer shortened. Duplicate actions and interrupted purchases still recover from authoritative state. Requests time out instead of remaining busy indefinitely; a failed replay verification clears prior success feedback.

Last-flight replay and finish-flight controls alter presentation only. Existing native physics, twelve layouts, item rules, coin economy, signed application profile and persisted campaigns are unchanged. The existing music and its attribution are retained. Native host replay is off-chain evidence, not CKB settlement.

Static scenery is cached by viewport and region. Canvas backing is capped at 4,194,304 pixels; reduced motion suppresses camera shake and ambient motion, and idle reduced-motion frames reuse the picture. Sprite regions are defined once and particle feedback is bounded.

## Validation

- `npm run build` and all 105 `npm test` checks pass.
- `tests/skyward-flow.mjs`: all twelve levels completed through the actual pointer controller against an isolated copy of the deployed native runtime; shop purchases, lost purchase responses, stale actions, reconnect, reset cancellation, pointer ownership, tap cancellation, menu pause/resume, finish-flight, replay and failed verification tested.
- `tests/live-skyward.mjs`: twelve levels / 33 campaign actions, item consumption and coin purchases; online replay and exported evidence verified with the deployed native binary.
- Browser inspection at 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844 and 844×390; real pointer launch, result, next island and in-game purchase.

Deployment updates only the store/web image. It preserves native game containers, signed sessions and account data. Back up the platform database before replacing the store container.
