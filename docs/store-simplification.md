# Store simplification — 0.30.0

The discovery page should help a player choose a game and start it. Repeated promotion and competing entry points were pushing the catalog below the first screen.

## Changes

- Keep one genre filter in the catalog. Remove the duplicate sidebar genre navigation.
- Keep a compact featured game with its actual title, art, Play, Details and next-game control. Remove the full 13-game featured rail that repeated the catalog, the oversized introductory heading and decorative edition number.
- Remove the repeated benefit strip, wallet promotion and studio advertisement. Wallet access stays in the persistent header; publishing stays in main navigation.
- Make each card's cover and title one details target. Keep its direct Play action. This replaces three separate details buttons without reducing the clickable cover/title area.
- Preserve price, Myelin branding, player count and distinct developer/publisher links on cards. Full wallets, port credits, controls and reviews remain in details.
- Give display preferences one navigation location, available in the mobile drawer as well. Footer contains Source, About and Privacy rather than another brand, studio link and settings button.
- Consolidate Publishing studio into one heading and one Publish action; remove the promotional banner and duplicate empty-state create button. Keep onboarding steps and fee information.
- Delete obsolete CSS for the removed surfaces instead of merely hiding them.

## Deliberately retained

Library and Purchases are different: playing history versus payment receipts. Developer and publisher attribution may belong to different people. Item store is a discovery/inventory catalog; spending and equipping remain inside games. Community's overall and recent reviews cover different time windows. Those distinctions should not be merged just to reduce the number of labels.

No authentication, transaction, game rules, Myelin evidence, inventory or database schema changes are part of this release. Game controls continue to belong to the game scene.

## Validation

- All 134 existing Node tests pass; production build passes.
- At the same 1280×720 viewport with no signed-in account, homepage buttons fall from 97 to 47. Card buttons fall from four to two. Catalog heading moves from approximately 1271px to 508px from page top.
- Browser checks at 390×844, 844×390, 1920×1080, 2560×1080, 2560×1440 and 3840×2160: all 13 cards remain present; no horizontal page overflow or horizontally clipped card, hero or filter buttons.
- Checked title search, combined Strategy/friends filtering, featured-game switch, mobile navigation, preferences, game details, original developer and publisher links, creator collections, reviews, wallet account entry, purchase history and the consolidated publishing action opening the editor.
- Verification uses an isolated local Store and fixture account. No purchase, wallet signature or production player mutation is required for this presentation change.

## Rollout

Published implementation `a7e2b9e` to `/data/utxoplay/releases/20261024-store-0.30.0`. Store container `185d7e7c1116` is healthy. All 20 other running containers retained their IDs.

The public health endpoint reports 0.30.0. Entry JS/CSS and lazy publishing JS/CSS match the local production build byte-for-byte. All 13 built-in game credit records, creator routes and publishing/privacy notices were checked over public HTTPS. A verified online SQLite backup was made before rollout: `platform-before-0.30.0-1792830392.sqlite`. Browser interaction checks were performed against the isolated local server, not claimed as live payment testing.
