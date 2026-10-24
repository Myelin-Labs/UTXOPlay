# Creator collections and purchase attribution — Store 0.27.0

Developer and publisher credit names open role-specific collections from game cards, details and community pages. Navigation stays inside the Store, supports ordinary browser links/back/forward, closes the details dialog, and scrolls immediately to the new page. Catalog loading and failures have explicit states and a retry control.

The current curated catalog groups Arthur Zhang’s eleven original games under development and all thirteen games under publishing. Retric and the Teeworlds authors retain separate original-development collections. Unknown developer wallets stay unknown.

## Identity boundaries

Collection routes use `/creators/{developer|publisher}/{anchorGameId}`. The anchor is resolved from the public catalog, never from arbitrary URL-provided names or addresses. Publisher grouping uses the publishing wallet, so identical display names cannot merge different accounts. Curated original developers group by their recorded wallet or original-project URL. A vendor’s developer claim is scoped to its publishing wallet: it cannot join a curated developer’s collection or another publisher’s developer collection by claiming the same address. Names without wallet/source identity remain listing-specific. Collections are credit navigation, not ownership attestations or new authorization rules.

## Publishing and receipts

Private drafts can remain incomplete. Publication requires both original-developer and publisher display names. An optional `developerSourceUrl` must be a public HTTPS URL; private addresses, executable URL schemes, credentials and query/fragment payloads are rejected. The final publishing step previews both roles and the owner-derived publisher wallet. Studio cards show live credits when a live release exists, with draft changes kept distinct. Default field normalization applies equally to live and draft views, avoiding a false unsaved-changes message on existing listings.

Orders already persist a game snapshot in the quote. The receipt API now exposes the developer and publisher from that snapshot as `credits`, and checkout, saved receipts and receipt rows display the recorded attribution. Later listing renames, credit edits and payout changes never rewrite old order credits. Receipts created without credit metadata explicitly return `credits: null`; they are not backfilled from the current listing. The publisher identity wallet and the publisher payout destination have distinct labels. Payment split, transaction construction and authorization remain unchanged.

## Validation

126 Node tests pass. New coverage verifies publisher wallet grouping across display-name changes, separation of same-name accounts, unknown developers, isolation of unverified developer claims across publishers and curated authors, rejection of unsafe source URLs, publication of incomplete drafts being blocked, live/draft credit separation, historical receipt preservation and absent older receipt metadata. Production build passes. Local browser checks cover developer (11 games), publisher (13 games) and Retric (1 game) collections, in-app navigation from the detail dialog, the source-link publishing preview and a cancelled fixture order with historical credits. Collection layouts have no horizontal overflow at actual CSS sizes 390×844, 844×390, 1920×1080, 2560×1080, 2560×1440 and 3840×2160. All form and receipt interaction uses an isolated local account; no real wallet signature or payment is performed.

Deployment recreates only the Store as `utxoplay:0.27.0`, following an online SQLite backup. No database schema or native game/profile change is involved. Rollback uses the 0.26.0 Store image and retains existing runtime data.

## Published verification — 2026-10-24

Implementation `128abe0` is deployed at `/data/utxoplay/releases/20261024-store-0.27.0`. Public HTTPS health reports 0.27.0. All thirteen original credit records remain identical to the committed catalog. Publisher, original-developer and Retric collection URLs serve the current application; its entry JS/CSS bytes match the tested local build. Collection selection against the live catalog returns 13, 11 and 1 titles respectively. The publishing guide includes required names and receipt snapshot semantics.

Online backup `platform-before-0.27.0-1792827638.sqlite` passed `quick_check`. Store container `3b1bcdf9c7bc` replaces the previous Store; all twenty other running container IDs remain unchanged. UI acceptance was performed against the isolated localhost Store; production checks used public HTTPS and asset integrity, without creating production accounts, projects or orders.
