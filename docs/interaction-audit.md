# UTXOPlay interaction audit — 0.4.0

Date: 23 October 2026. Scope: storefront discovery, account entry, library, developer workspace, embedded game navigation, mobile layout and keyboard access. This is an interaction review, not a security assessment or a claim of complete assistive-technology certification.

## Findings and changes

| Area | Finding | Shipped change |
| --- | --- | --- |
| Discovery | Small text, little differentiation between games, immediate launch without context | Dark charcoal surfaces, larger type, individual game accents, manually selected featured game, illustrated details with controls and device guidance |
| Search | Weak recovery from empty results | Case/whitespace-tolerant search combined with genre and play-style filters, result announcements and clear-filters action |
| Cards | Nested React component definition could replace card DOM during parent updates | Stable module-level cards preserve focus and use short layout transitions |
| Wallet | Escape did not close the modal; background retained keyboard focus | Native modal dialogs with focus restoration and inert background; CCC picker has shadow-root-aware Tab navigation, explicit cancel and Escape handling |
| Wallet state | Wallet confirmation text reused for unrelated operations | Separate signing, signature verification, game opening and project saving feedback; signature waiting can be cancelled |
| Account changes | Logout could race the next signing challenge | Wallet transitions serialize logout before requesting another challenge; stale signing results are ignored |
| Data loading | Account/library/project failures could be mistaken for an empty account | Loading states, explicit errors, retry actions and stale-owner data isolation |
| Library | Returning to a game required browsing the catalog again | Most recently played shortcut, dated library cards, explicit guest/wallet separation |
| Game entry | Fullscreen started before the actual game; iframe load had no readiness acknowledgement | Real game-start signal requests fullscreen and enters immersive layout; same-origin readiness message, slow-load retry, controls panel and reload confirmation |
| Developer studio | Technical features lacked an approachable starting path | Working example manifest copy, reference links, private project form with inline errors, separate save state and retained unsaved draft while navigating dialogs |
| Mobile | Navigation lacked modal keyboard behavior; hero copy could overlap its footer | Accessible drawer, stacked layouts and content-sized hero; checked at 390 × 844 with no horizontal page overflow |
| Motion | No user control over transitions | Bundled Motion with OS reduced-motion support and a local preference; no autoplay carousel or remote effect CDN |
| Assets | Two store covers totaled 4,447,828 bytes | Same-dimension WebP alternatives total 493,584 bytes, about 89% less; source PNGs retained |
| Supporting pages | About and integration guide still referred to three games | Four-game information, consistent dark document layout, motion license and local-preference disclosure |

## Verification

- Production build completes. Vite reports harmless dependency-level `use client` directives ignored in this client-only bundle.
- 17 Node tests pass: existing authentication, origin checks, account/game isolation and project validation plus combined catalog filtering, actionable errors and shared-shell cache-version coverage.
- Live local CKB cryptographic challenge, replay rejection, logout revocation, fresh sign-in and persisted chess move recovery pass with a disposable test key. No funds or transactions.
- Browser checks: wallet Escape/focus restoration; CCC Tab focus enters the JoyID button and background is inert; cancelling returns to account UI; search and zero-result recovery; friends filter; details and launch; library ordering; Studio sign-in entry and manifest-copy feedback; mobile navigation and preferences; reduced motion disables animated backgrounds and persists across reload.
- Browser game checks: Skyward launch enters immersive mode, control dialog and reload cancellation work; chess board and pieces render with readiness acknowledged; Teeworlds restores its previous result and a fresh practice match enters immersive mode.
- Public `https://store.utxoplay.io` deployment reports 0.4.0 and is healthy. Served HTML, JS, CSS, shared shell, licenses and WebP assets match the built files by SHA-256; all four game shells carry the current cache key.
- Public cryptographic login/logout/relogin and save recovery pass. A two-account OpenStrike duel passes authenticated WebSocket input, verified export, invalid-input rejection and outsider isolation (90 received updates). Existing game runtime containers were not recreated.

## Practical limits

- The embedded test browser rejects native fullscreen; the immersive layout is verified as the fallback. Native fullscreen remains subject to browser support and user activation.
- The test browser exposes JoyID discovery but has no installed external wallet extensions. Actual device/passkey prompts and every external wallet extension were not manually signed through this UI. Server signature verification is independently exercised.
- FPS/Teeworlds play still needs a keyboard and mouse; responsive store layout does not add touch controls to those games.
- Public project publishing remains curated. The Studio form saves private drafts; Fiber remains an optional developer testnet extension.
