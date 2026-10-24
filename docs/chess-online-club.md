# The Quiet Board: Blue Hour Club — Store 0.29.0

The game offers private online tables for two accounts or browsers, three Stockfish difficulty levels, and pass-and-play. Invitations, recent tables, move history, replay, export and settings live inside the game scene and its overlay. The new ImageGen environment uses a blue-hour courtyard, walnut, champagne brass and ivory/jade ceramic pieces. The asset manifest records the exact prompt and provenance.

## Online play and persistence

A 96-bit random invitation identifies a table. The creator chooses White or Black, and the first other authenticated account takes the vacant seat. Further joins are rejected; existing members can reconnect. Both guest and wallet sessions work. Guest identity belongs to the browser cookie; a wallet identity returns through wallet authentication. Display names come from the existing profile system. No opponent wallet or internal account identifier is exposed through the room view.

Room membership is persisted in the Store's `chess_rooms` table. The native runtime account is a domain-separated hash of the room ID. Personal practice continues under the existing account ID, so starting an AI game cannot replace an online match. Recent tables restore the original room. New online matches allocate a fresh room instead of resetting another player's board.

The gateway checks membership, a filled second seat, side to move, exact session ID and expected block hash. Native Myelin validates legal moves, stale heads, game outcomes and commits. Room actions are serialized; moves, resignation and draw claims are accepted only on the player's turn. Chess rules, native application profile and saved game codec remain unchanged.

This is host-authorized off-chain Myelin replay. The Store authenticates seats; the existing native authority signs the session. Room membership is not a player-signed Myelin commitment, CKB settlement or a trustless multiplayer adjudication proof. Replay and export require membership and use the exact same native room session; the existing CLI verifies exports offline.

## Performance and recovery

Server-sent events push positions after accepted moves and seat changes. There is no recurring room-state polling. Heartbeats run every 15 seconds; streams are bounded to three per account and 200 globally, revalidate session identity and stop for slow consumers. Hidden tabs close the stream and reconnect when visible. A bounded 64-room cache reduces repeated native state reads; revision comparison prevents an older read replacing a newer commit. The gateway invalidates cache on uncertain mutation responses. Native stale-head checks remain authoritative after races or timeouts.

Stockfish loads only for computer play, in a single-threaded Web Worker. The 17.1 Lite build is 7.28 MB before transfer compression, uses 16 MiB hash, and searches for 180/500/1100 ms at three skill levels. A completed worker is reused; menus, review, hidden tabs and changed games cancel pending work. Idle workers are released. Results are bound to the current request epoch, session and block and checked against native legal destinations before submission. No Elo rating is advertised. Engine binaries use immutable versioned caching. The corresponding source and matching network are provided locally with the GPLv3 license.

The board keeps its 64 square elements. Unchanged move journals and session details are not rebuilt. The scene is CSS/DOM with no continuous graphics loop. The generated backdrop is approximately 287 KiB WebP, smaller than the prior 382 KiB environment. The board stays square on wide monitors; extra space extends the room.

## Validation and deployment

134 Node tests pass, including authenticated room seats, turn authorization, stale heads, private exports, SSE cache behavior, Stockfish protocol/cancellation and warm worker reuse. The shipped controller passes DOM/transport tests for duplicate and illegal input, worker cancellation, failed saves, failed verification, read-only review and SAN notation.

`CHESS_BINARY=/path/to/myelin-chess node tests/chess-online-flow.mjs` runs the real runtime, two distinct identities, a third-party rejection, four-ply checkmate, Store/native restart, unchanged head and seats, native replay and offline export verification. Personal practice remains isolated. No new native executable is needed for this release.

Local production-build browser checks cover white and black inputs, automatic flipped orientation, two-account synchronized moves, refresh recovery and a real Stockfish response. The board remains square with no horizontal overflow at 390×844, 844×390, 1920×1080, 2560×1080, 2560×1440 and 3840×2160. Scene controls remain within the viewport at phone and 4K sizes. No physical-device frame-rate benchmark is claimed.

Deployment backs up SQLite, installs the additive room table on startup and recreates only the Store image. Native games and existing saves remain in place. Rolling back the Store to 0.28.0 hides online rooms without deleting their membership rows or native state.
