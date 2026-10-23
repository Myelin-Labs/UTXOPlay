# UTXOPlay brand assets

The supplied paired artwork is preserved in `assets/brand/source/utxoplay-light-dark.png`. The left artwork is the light variant; the right artwork is the dark variant. These are direct pixel crops, not regenerated interpretations of the logo.

## Asset kit

Each theme has transparent, rounded PNG icons at 16, 32, 48, 64, 96, 128, 180, 192, 256 and 512 px, plus WebP at 96, 192 and 512 px. Each also has a multi-resolution ICO, an opaque 180 px Apple touch icon, and a padded 512 px maskable app icon. The 512 px master is downsampled from the original; larger raster resolutions would not add original detail.

Rebuild both kits with ImageMagick 7 installed:

```sh
node scripts/build-brand.mjs
```

Crop coordinates and rounded alpha masks are recorded in that script. It removes the presentation margins and outer background, retaining the artwork inside each app tile. The original is never overwritten.

## Current release: dark only

Only dark assets are copied to `public/brand`. The source light kit is not included in the deployed application. The store explicitly uses the dark color scheme regardless of OS preference; no theme switch is exposed. Individual games retain their own artwork and palettes while using the same dark UTXOPlay platform mark.

Coverage:

- Desktop/mobile store header, footer and loading screen.
- Account dialog and the CCC wallet connection application's icon.
- Developer workspace and project dialog.
- About, privacy and integration pages.
- Chess, Skyward and Teeworlds platform headers, plus Teeworlds credits.
- PNG/ICO browser icons, Apple touch icon and web manifest icons.
- The default social sharing image and link metadata.

Use the 96/192 px WebP pair for UI marks. The PNG endpoints are for wallets and app metadata. Decorative marks have an empty alt attribute alongside the visible UTXOPlay name. Avoid forcing a second background or border around the icon: the supplied artwork already contains its own rounded tile.

A later light-mode release should switch every platform mark, wallet application icon, metadata icon, manifest color and sharing image together, with accessible light UI tokens. Do not select light logos with `prefers-color-scheme` while the platform remains dark.
