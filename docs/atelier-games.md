# The Atelier collection — Store 0.25.0

Four original games use a new `myelin-atelier` runtime, pinned to Myelin v0.31.0 revision `c0ac291c03ed8996e62834cb3f480e1ce8dc09a2`. Existing arcade, Prism, miner, chess and Skyward profiles and storage are unchanged.

| Game | Distinct mechanic | Progression |
| --- | --- | --- |
| Rune Foundry | Match four connected runes; gravity creates chain reactions. Earn energy from groups, then spend three to reforge the bottom row. | Clear 288 runes, twelve speed stages and an expanding colour set. |
| Lumen Weave | Every clockwise tile rotation turns its opposite twin counterclockwise. Restore power from the golden source. | Twenty-four different networks, generated with reversible pair rotations from a connected spanning tree. |
| Orbit Courier | Collect cargo on two outer tracks and bank it at the inner dock; speed control and energy-funded antipodal phase hops change the timing puzzle. | Twelve routes, increasing sentinel density, speed and delivery targets. |
| Mosslight | Turn-based seed gathering; temporary lanterns attract guards and defeat them along four wall-occluded light rays. | Twelve gardens, increasing guard and seed counts, limited energy and occasional healing. |

All four own the entire viewport. The scene contains the HUD, five touch controls, pause overlay, sound/music, quality controls and signed-run tools. No outer game controls or nested application shell is added. Pointer selection uses the inverse of the same isotropic transform as rendering. Backgrounds fill the display while gameplay geometry retains its proportions. Safe-area insets protect the controls.

Eight ImageGen production assets provide four environments and four six-sprite atlases. `assets/atelier-source/` preserves the PNG sources; `docs/atelier-art.json` records prompts and provenance. Runtime delivery uses WebP with alpha preserved. The optional `tools/build-atelier-art.mjs` measures each sprite's alpha bounds and rebuilds WebP assets and catalog covers. No third-party gameplay code or art was imported. Music is a quiet opt-in procedural arpeggio, with separate gameplay cues through the existing audio engine.

Static scenery is cached. Idle puzzle/garden scenes and paused screens do not redraw unchanged canvases; unchanged HUD values do not rewrite the DOM. Backing resolution is capped at six million pixels, with the existing adaptive resolution scheduler. Reduced motion and low-power settings suppress decorative animation. Browser rendering never advances native state.

## Rules and signed evidence

The browser predicts integer-only 30 Hz controls; native Rust executes every submitted tape independently. Batches contain 1–60 inputs. Ordinary inputs use five bits; Lumen additionally accepts 64–99 for direct tile selection/rotation. All other values and unknown action fields fail closed. Each action binds the current session and head. A failed or mismatched save pauses play and recovers the last authoritative snapshot. Resume/restart requests carry a generation guard so a late response cannot resume after focus loss. Runs last at most thirty minutes.

Each kind has a distinct genesis profile. The program commitment binds the native game, session implementation and Cargo lockfile. The new service uses its own data directory and does not reinterpret existing signed saves. Signature replay is **off-chain host replay**, not CKB verification, publication or settlement. Device-best scores are local convenience data.

## Validation

- 121 Node unit tests, including the four rulesets, direct touch, catalog routing and loader contracts.
- Five native tests: strict atomic input validation, all 24 pointer-driven circuits, occluded garden light, profile separation, recovery, signed replay and tamper rejection. Strict Clippy and rustfmt pass under Rust 1.97.1 with the lockfile.
- 98 complete-state native/browser tapes, including all 24 circuit chapters from genesis and direct tile input. The portable Debian Bookworm executable is used for conformance and offline export verification.
- Actual controller tests against an isolated store and native runtime: rapid taps, pause, replay, cancel/restart, duplicate activation, delayed requests followed by blur, dropped saves, and reconnect.
- Native Canvas rendering at 1920×1080, 2560×1080, 2560×1440, 3840×2160, 390×844 and 844×390 for all four games; state immutability, idle cache behaviour and inverse pointer mapping assertions. Browser checks cover actual full-scene rendering, touch rotation, save status and menus.
- HTTP tests for all four independently saved sessions, stale-head/invalid-input rejection, replay and downloaded signature verification. Lumen advances a chapter; Orbit collects and banks cargo; Mosslight earns seed and guard points.

Run the optional Canvas/DOM harnesses with `ART_TOOL_MODULES=/path/to/node_modules` containing `@napi-rs/canvas` and `jsdom`. They are development dependencies only. Set `STORE_URL` explicitly for the HTTP harness; it creates one test guest and real signed runs.

## Deployment and rollback

Store and the new atelier service use image `utxoplay:0.25.0`. Atelier listens only on the internal games network at port 8788, with `/data/utxoplay/shared/atelier` mounted for persistence. Build the executable using `deploy/ArcadeBuilder.Containerfile`, Rust 1.97.1, `cargo build --locked --manifest-path games/atelier/Cargo.toml`, then copy it into `deploy/bin/myelin-atelier` before the store image build.

Portable executable SHA-256: `bf20228a36c25316cdaaec9add0450f27639522719ff7b32040eaf936e747b3d`.

Back up the platform SQLite database using its online backup API. Recreate only `store` and add `atelier`; all existing game containers remain running. Rollback restores the previous store image/Compose release and stops the atelier service, retaining its data for inspection. Existing game data and the shared TLS proxy are not changed.
