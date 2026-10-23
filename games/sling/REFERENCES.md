# References and implementation decisions

## Myelin

- Source: https://github.com/Myelin-Labs/Myelin
- Exact revision: `5c38d13348e1d2673ae52c742dabce0aa0308195` (CellScript 0.31 alignment).
- Uses `myelin-session`, `myelin-consensus`, and `myelin-session-store-rocksdb` through pinned Git dependencies.
- Session integration is original application code. It uses the public transition-executor, application-frame, finality-verifier, and storage APIs.
- CKB chain settlement and on-chain game execution are intentionally outside this first playable application's implemented capability.

## Slingshot references

- **Matter.js slingshot example**: https://github.com/liabru/matter-js/blob/master/examples/slingshot.js — MIT. Reference for pull/release interaction, not a dependency or copied implementation.
- **Angry Aliens**: https://github.com/crystal-bit/angry-aliens — reference for the complete slingshot-game genre. No code or assets are bundled.
- Authoritative physics is original Rust integer arithmetic with fixed steps; floating-point browser simulation is not used to decide results.
- Characters, environment, interface, levels and game name are original. No Rovio/Angry Birds art, music, logos, or source is used.
