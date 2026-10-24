# Unified game loading — store 0.14.0

All nine bundled games use `public/game-loader.js`. The store owns one loader above its iframe; a direct `/games/<id>/` entry owns one inside the game document. There are no persistent controls added outside the game. External vendor launch tickets remain a separate flow.

The shared Shadow DOM component uses the UTXOPlay mark, each game's title and cover, the original Myelin logo/tag, four startup milestones, an illuminated progress rail, and a short completion transition. It supports narrow/short screens, reduced motion, a live status announcement, and a labelled progress bar. Game input remains inert until the loading layer exits.

## Progress contract

Progress measures completed startup work, not transferred bytes or elapsed time:

- Program initialization: 10%.
- Required artwork/scene resources: 45%, counted as individual resources finish loading/decoding.
- Successful session response: 30%.
- Scene readiness: 15%, only after all preceding gates and two animation frames.

Games call `boot()`, `assets(completed,total)` or `images(sources)`, `session()`, then `ready()` on `globalThis.UTXOPlayLoader`. Calls may finish out of order. `ready()` requests completion; it cannot bypass missing resources or a missing session. `fail('assets'|'session'|'graphics'|'game')` retains the achieved percentage and provides a retry. A failure during the paint boundary cannot become 100%.

Miner tracks 16 WebP images; chess and Skyward track their required image sheets; the four arcade games track their key art; Teeworlds tracks its map and four image sheets. OpenStrike's adapter waits for the existing engine module (arena and WebGL scene construction) and checks its session without changing the engine bundle.

The sole child protocol is `utxoplay:load`. The host validates source window, origin, game, launch attempt, monotonic percentage/milestones, and the full completion gate. `utxoplay:load-request` recovers a report when the host attaches late. Retry replaces the iframe and attempt token. The old generic `utxoplay:game-ready` event has been removed.

A stall longer than 12 seconds offers retry while retaining progress. It does not invent a network failure or advance a timer toward 100%. A completed frame is revealed after the 600 ms exit transition. Startup timers are cleared on completion or navigation.

## Validation (2026-10-24)

- `npm test`: 57 passing tests, including stale attempts, regressing reports, malformed completion and all nine HTML entrypoints.
- `npm run build`: passed, including Brotli/gzip regeneration.
- `tests/game-loader.mjs`: all nine protocol contracts; two-frame gate; late host request; missing artwork; script failure; retry callback; standalone input lock/release.
- `tests/game-shell.mjs`: all nine games retain controls inside their viewport.
- Actual UI/native-runtime regressions: `miner-flow.mjs`, `arcade-flow.mjs prism-breaker`, `skyward-flow.mjs` passed.
- Browser: all nine store iframe entries and all nine direct game entries finished loading and released their input locks. Chess, Skyward, arcade and miner used isolated native engines. Teeworlds and OpenStrike used their actual frontends with a local empty-lobby transport fixture; this is not a multiplayer match/replay test.
- Browser: real unavailable arcade service remained below 100%; retry changed the launch token. Desktop, portrait and short landscape layouts inspected.
- `tests/loader-preview.mjs` is an explicitly labelled local visual fixture with a fixed sample percentage; it is not part of the production server.

This is a store/web release. Native engine images, application profiles, session formats and player data are unchanged.

## Published release

Store image `utxoplay:0.14.0` is deployed from
`/data/utxoplay/releases/20261024-store-0.14.0`. The platform SQLite backup passed
`quick_check` before the store-only replacement. All six native runtime container
IDs and image versions remained unchanged.

Public HTTPS verification returned version 0.14.0, matched the deployed bytes for
all nine entrypoints, the loader, shell, OpenStrike adapter and miner art module,
and loaded both brand images. A single guest account successfully read state
from all nine production games. Visual browser verification used the identical
local build; production browser rendering was not separately asserted.
