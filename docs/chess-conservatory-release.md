# Chess — The Conservatory (store 0.21.0)

The Quiet Board now uses an original sunlit conservatory environment, glazed ivory/jade Staunton pieces and a wood/brass board treatment. Store art and the immersive menu share that direction. Artwork prompts, provenance and licenses are recorded in [the asset manifest](../games/chess/ASSETS.md).

## Play

- Pass & play remains available. Three optional local computer partners (Gentle, Club, Focused) and a choice of White/Black apply to a fresh game. These are bounded training levels, not rated Elo engines.
- Tap-to-move, pointer-owned drag-and-drop, keyboard grid navigation, explicit promotion choices, optional destination hints and reduced-motion-aware move animation.
- SAN move journal, PGN export, FEN copy and read-only verified position review. Native evidence export remains separate.
- All controls and dialogs live in the game surface. The square board extends into a widescreen environment without stretching pieces.
- Music/effects share a persistent volume setting. Sound remains opt-in under browser autoplay rules.

## Runtime boundary

`chess.js` 1.4.0 provides client move generation and SAN/PGN formatting. The search runs in a disposable module Worker with depth, node and wall-clock budgets (180/420/800 ms). Menus, review, hidden tabs and new matches cancel it. Replies bind to a worker epoch and the exact session/block; only native-advertised root moves can be submitted. A native-advertised draw claim can be accepted on a computer turn.

Every computer move is an ordinary input submitted to the unchanged native Chess runtime. No rules, session profile, evidence schema or native image changed. Myelin evidence here remains off-chain host replay; it is not CKB settlement.

## Validation

- `npm test`: 101 passing tests, including coordinate inverses for all squares/orientations, root legality, mate choice, SAN and corrupt preference recovery.
- `ARCADE_TEST_MODULES=/tmp/utxoplay-render-check/node_modules node tests/chess-client-flow.mjs`: shipped controller tested with DOM/transport doubles for cancelled/stale workers, duplicate input, illegal destinations, failed verification, read-only review, notation and promotion choice.
- `node tests/chess-native-flow.mjs`: isolated real native runtime, 24 training plies, stale-block rejection, signed replay/FEN/export agreement, then a checkmate and its verified replay.
- Browser: actual point-and-click, dragging, computer response, opponent selection and in-game confirmation. Square board and control bounds checked at 390×844, 844×390, 1920×1080, 2560×1080, 2560×1440 and 3840×2160. Desktop and mobile visual inspection performed. Browser viewport capture sometimes returns a stale scaled frame immediately after resize; DOM bounds were checked separately.
- `npm run build` and `git diff --check` pass. No physical mobile-device performance certification or engine Elo claim is made.

## Deployment

Upgrade only the store image to `utxoplay:0.21.0`, preserve all native runtime containers, and retain the previous release/image plus a consistent SQLite backup for rollback. Existing platform sessions and native Chess state remain mounted from shared storage.
