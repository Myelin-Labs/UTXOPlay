# Game-owned interface — store 0.10.0

Playing a bundled game occupies the whole viewport. The store header, sidebar, title, footer and external reload/controls/fullscreen toolbar are absent from play. The game owns its HUD, touch inputs, settings, help, restart, replay/export, fullscreen and return-to-store actions. Future controls must stay inside this boundary; do not add another toolbar or side panel outside the game.

The shared game interface preserves the games' existing DOM controls and handlers, moves them into their game surface and removes obsolete page furniture. A single in-game menu contains secondary functions; opening help/credits closes that menu first. OpenStrike retains its native arena menu. Myelin logo/tag remains inside every game. Rendering quality is accessible from each game.

Skyward has an in-game item/launch hotbar, score and chapter HUD, and flight feedback. Angle/power sliders, music, campaign progress, help, replay and export are in the menu. Arcade touch controls sit inside the viewport and only appear for coarse pointers; keyboard/pointer play keeps the field clear. Chess keeps the board, players and position status visible, with match actions and move journal in its menu. Teeworlds keeps its arena HUD and touch controls; its menu explicitly states that live rounds continue.

The menu releases held input through the existing blur handlers, pauses solo arcade runs, cancels Skyward pulls, isolates menu keyboard events and restores focus. Escape opens/closes the menu. Fullscreen is an explicit game-menu action, independent of the store layout. Reload requires an inline confirmation.

## Validation

- 51 Node tests and production build passed.
- `tests/game-shell.mjs`: all eight games preserve original ID-bearing nodes and functional controls; every control is contained by its game viewport; menu input isolation, focus restoration, restart/help transitions and Myelin assets checked.
- `tests/arcade-flow.mjs`: all four actual app modules run with the shared interface against an isolated real arcade runtime. Opening the menu pauses/saves; countdown input, replay, restart cancellation, duplicate-click guards and network recovery pass.
- `tests/skyward-flow.mjs`: actual app with shared interface, native Canvas rasterization and isolated signed runtime. Menu, items, launch, replay, next island, last-shot rescue and retry pass.
- Responsive CSS preserves canvas aspect ratios and reserves HUD/touch space in portrait and landscape. Browser preview connection timed out; these checks do not establish pixel-level layout or physical-device touch behavior.

Only the store image advances to `utxoplay:0.10.0`. Game engines, native binaries, application profiles and data volumes remain unchanged. The previous release is retained for rollback. Myelin remains an off-chain authority-signed runtime with host replay, without a CKB settlement claim.

## 0.11.0 follow-up

The long combined menu is now divided into flat Game, Settings and Help views; Skyward also has an Item Store view in the same dialog. Opening native help/credits blocks global game hotkeys as well, and closing them restores focus to the game menu button. The Skyward hotbar keeps the equipped-item description visible; spending and extra-flight use are deliberate actions inside the store. See [coin campaign rules](skyward-coins.md) for purchase safety, validation and the new archive boundary.

The shared startup surface and per-game readiness contract are documented in
[game-loading.md](game-loading.md). New bundled games must report program,
resource, session and scene readiness through that contract before the store
reveals their iframe.
