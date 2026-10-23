# References and implementation decisions

## Myelin

- Source: https://github.com/Myelin-Labs/Myelin
- Exact revision: `5c38d13348e1d2673ae52c742dabce0aa0308195` (CellScript 0.31 alignment).
- Uses `myelin-session`, `myelin-consensus`, and `myelin-session-store-rocksdb` through pinned Git dependencies.
- Session integration is original application code. It uses the public transition-executor, application-frame, finality-verifier, and storage APIs.
- CKB chain settlement and on-chain game execution are intentionally outside this first playable application's implemented capability.

## Chess references

- **jordanbray/chess**: https://github.com/jordanbray/chess — MIT. `chess` 3.2.0 is the actual Rust rules dependency; legal moves and game history are computed server-side.
- **chess.js**: https://github.com/jhlywa/chess.js — BSD-2-Clause. Reviewed as a browser-first alternative, not bundled or used. A Rust engine avoids trusting browser move validation.
- Interface and chess artwork are original. No Lichess/Chess.com interface, artwork, or audio has been copied.
