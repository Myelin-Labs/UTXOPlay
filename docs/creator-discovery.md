# Creator discovery and publishing feedback — Store 0.28.0

Creator collections now include text search, genre and free-to-play filters, natural title sorting and a resettable empty state. Result counts are announced to assistive technology. Developed/Published tabs follow the same recorded wallet identity and retain the existing publisher-scoped boundary for vendor developer claims. Unknown developer wallets do not produce a cross-role link. Changing collection routes resets the filters.

Saving a listing reconciles the server-normalized fields back into the editor. Fields changed since the request began are preserved. Draft comparison ignores object key order and treats absent optional text fields as empty. Busy actions disable the editing fieldset and reject duplicate action dispatches.

The publication review shows live versus draft changes for developer name, developer wallet, original project and publisher name. This is an attribution preview, not a wallet-ownership claim. Earlier order snapshots remain unchanged. Missing developer or publisher names return the editor to Game details, mark the fields invalid and focus the first missing name. Continue and Publish use separate button identities and explicit button types: switching steps from a click cannot accidentally submit the reused button as Continue.

## Validation

All 131 Node tests pass and the production build succeeds. New tests cover role navigation boundaries, combined filters, natural sorting, source-order preservation, server normalization, edits made during a save, attribution additions/removals and missing credit names.

Local browser verification uses an isolated account and database. It covers Retric search, Puzzle/free/sort combination, empty-result reset, developer/publisher navigation, saving padded names and normalized URLs, closing without a false unsaved warning, live/draft attribution comparison, and missing-name publication validation. The latter exposed and verified the fix for the reused button's unintended form submission. No external instance publication or payment is performed.

Collection layout checks show no horizontal overflow at actual CSS dimensions 390×844, 844×390, 1920×1080, 2560×1080, 2560×1440 and 3840×2160. Phone publishing inputs, validation and attribution comparisons also fit without horizontal overflow; desktop and phone screenshots were inspected.

Only the Store image changes to 0.28.0. Deployment uses an online SQLite backup and recreates only the Store container. There are no database schema, native runtime, game rule or profile changes. Rollback uses the 0.27.0 Store image with the existing data.
