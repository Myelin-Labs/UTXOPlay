# References and implementation decisions

## Myelin

- Source: https://github.com/Myelin-Labs/Myelin
- Exact revision: `5c38d13348e1d2673ae52c742dabce0aa0308195` (CellScript 0.31 alignment).
- Uses `myelin-session`, `myelin-consensus`, and `myelin-session-store-rocksdb` through pinned Git dependencies.
- Session integration is original application code. It uses the public transition-executor, application-frame, finality-verifier, and storage APIs.
- CKB chain settlement and on-chain game execution are intentionally outside this first playable application's implemented capability.

## Chess references

- **jordanbray/chess**: https://github.com/jordanbray/chess — MIT. `chess` 3.2.0 is the actual Rust rules dependency; legal moves and game history are computed server-side.
- **chess.js**: https://github.com/jhlywa/chess.js — BSD-2-Clause. Version 1.4.0 supplies browser SAN/PGN notation. The native Rust engine remains authoritative for move validation.
- **Stockfish.js**: https://github.com/nmrugg/stockfish.js — GPLv3. Actual unmodified 17.1 Lite single-threaded engine, pinned to npm commit `602fd7e1a571a2be71f242942db90483731f2a1f`. Browser Worker UCI integration uses bounded think time and 16 MiB hash. License, authors, build instructions, source and matching network are served in `web/engine/`.
- Interface and chess artwork are original. The engine is attributed separately from the game developer/publisher.
