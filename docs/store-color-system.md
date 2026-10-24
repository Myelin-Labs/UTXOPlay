# Store color system — 0.31.0

Keep UTXOPlay's green identity while separating the game artwork, navigation, surfaces and actions more clearly. This is a color-only refresh of the existing simplified interface; navigation, game controls and business logic are unchanged.

## Palette

| Role | Token | Color |
| --- | --- | --- |
| Page canvas | `--canvas` | `#090f0d` |
| Header / navigation | `--shell` | `#0d1511` |
| Cards / dialogs | `--panel` | `#151f1a` |
| Raised controls | `--raised` | `#1d2b23` |
| Recessed fields | `--input` | `#0d1711` |
| Primary text | `--ink` | `#f2f7f4` |
| Secondary text | `--secondary` | `#b9c9bf` |
| Muted text | `--muted` | `#91a89a` |
| Primary green | `--lime` | `#65efa0` |
| Primary hover | `--lime-hover` | `#8cf7b9` |
| Selected background | `--accent-wash` | `#173c29` |
| Selected foreground | `--accent-soft` | `#b1f5cc` |

Use solid green for the main Play action and the compact FREE tag. Navigation and filters use a subdued green fill with a distinct border; secondary buttons use raised dark surfaces. Replace the old glossy button gradients and scattered gray-green text colors with shared tokens. Keep the game's artwork hues, Myelin purple, gold coin/rating colors, and warning/error colors distinct. Image scrims move toward neutral ink rather than casting more green over the artwork.

The shared tokens apply to discovery, cards, game details, account dialogs, creator pages, library panels, publishing fields/receipts, reviews and the item catalog. Game iframe styles and raster assets are unchanged.

## Verification

- Production build and all 134 existing Node tests pass.
- Checked the homepage at 390×844, 844×390, 1920×1080, 2560×1080, 2560×1440 and 3840×2160: 13 cards, the same 47 buttons, no horizontal overflow or broken loaded images.
- Browser-reviewed desktop/mobile home, game details, wallet dialog, mobile navigation, community and item store. Verified shared computed colors and preservation of the Myelin/coin colors.
- Representative text contrast ratios: primary text on card 15.60:1; secondary text on card 9.79:1; muted text on raised surface 5.82:1; Play/FREE text 11.62:1; selected navigation text 9.80:1. These are specific solid-color pairs, not a claim of a whole-site accessibility audit.

## Rollout

Released implementation `fd56dbc` as 0.31.0 at `/data/utxoplay/releases/20261024-store-0.31.0`, assembled from the verified 0.30.0 release plus all changed tracked files and the rebuilt frontend. Container `d9e5edb75061` is healthy; the other 20 running containers retained their IDs. Public entry and lazy publishing JS/CSS match the local build byte-for-byte. The public catalog still carries all 13 original credit records. Verified pre-rollout SQLite backup: `platform-before-0.31.0-1792830893.sqlite`.
