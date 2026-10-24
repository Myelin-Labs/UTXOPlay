# Developer and publisher credits — Store 0.26.0

Every catalog game has independent `developer` and `publisher` objects: `{ name, address }`. An unknown wallet is JSON `null`, never an empty or invented address in public responses. Built-in ports additionally have `portedBy` and an original-project link on the developer. Cards show both role names, details and community pages show expandable/copyable addresses, and catalog search matches either name.

## Current collection

All thirteen games are published by Arthur Zhang, with this user-supplied public CKB mainnet address:

```
ckb1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq238rvp7e36zawvdqruc5mpctgz6v95ngc4628yc
```

Eleven original games credit Arthur Zhang as developer with the same address. OpenStrike credits **Retric**, whose wallet is unknown; its upstream is [RetricSu/openstrike-fiber-arena](https://github.com/RetricSu/openstrike-fiber-arena), as recorded in the port’s NOTICE. Teeworlds credits **Magnus Auvinen & Teeworlds contributors**, whose wallets are unknown, consistent with the [upstream license](https://github.com/teeworlds/teeworlds/blob/master/license.txt). Both distinguish Arthur Zhang’s port and Myelin integration from original authorship. Existing asset and dependency license notices remain authoritative for their respective works.

The built-in address binding is catalog attribution supplied by the operator. Its CKB encoding is validated in tests; it is not a new cryptographic ownership attestation, a payment destination change, or a grant of project editing rights.

## Self-service publishing

Drafts store `developerName`, optional `developerAddress`, and `publisherName`. These remain editable text metadata. Published credits use the live snapshot, so saving a draft never changes public attribution until republishing. Unspecified older credits remain explicitly unspecified rather than guessing the author.

The server derives the publisher wallet from the authenticated project owner’s account. It does not accept `publisherAddress`, `publisher`, `owner`, `developer`, or `portedBy` through the draft input. Developer wallets must decode as CKB mainnet addresses; validation does not claim the publisher controls them. Names are limited to 80 characters and disallow control and bidirectional override characters. Optimistic revision checks are repeated after asynchronous address validation so a stale save cannot overwrite a newer draft.

Publisher identity, developer attribution, and `payoutAddress` serve different purposes. Credits never alter authorization, price splits, receipts, or runtime identities. Project ownership remains the existing authenticated account ID. The Publishing Studio explains the public wallet disclosure before publication, and the privacy/publishing notices describe it.

## Validation and rollout

124 Node tests pass, including role-specific catalog credits, mainnet address parsing, creator search, forged publisher/owner rejection, invalid developer wallets, draft/live separation, distinct payout and owner wallets, cross-account authorization and an asynchronous stale-save race. Production assets build successfully. Local browser checks cover the OpenStrike original/port/publisher split, unknown developer wallet, the full expandable address, and unclipped credits at 1920×1080, 390×844 and 844×390 CSS pixels. An isolated test account saved and reopened distinct developer and publisher names with a read-only publisher wallet; no production login or project was created. Native game rules, profiles, signed saves and runtime images are outside this change.

Release only the Store image as `utxoplay:0.26.0`. Take an online SQLite backup before replacing the Store. No database schema migration is needed. Rollback selects the previous Store image; retained JSON credit fields do not change game data or payment records.
