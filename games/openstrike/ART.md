# OpenStrike — Sunlit Harbor art and implementation

## Assets and provenance

- `web/art/harbor-keyart.webp`: original artwork generated with the built-in image_gen tool. Used in the game menu and store catalog.
- `web/art/limestone.webp`: original generated limestone/plaster albedo. Used on actual 3D arena surfaces, with restrained bump mapping.
- The interactive harbor, articulated robot, sporting rifle, glove geometry, foliage and scenery are original Three.js models in `client/scene.mjs`. No third-party character art is used.
- Three.js 0.186.1, its RoundedBoxGeometry, RoomEnvironment and geometry utilities are MIT licensed; license: `web/licenses/THREE.txt`.
- Movement prediction derives from the MIT-licensed Myelin-Labs/myelin-openstrike renderer. The native arena and original collision bounds remain unchanged.

## Generated image prompts

### Harbor key art

Use case: stylized-concept. Asset type: premium game key art, wide landscape 16:9, no typography. Create a beautiful polished low-poly 3D indie arena shooter scene for OpenStrike: a sunny Mediterranean coastal training courtyard, warm ivory plaster modular architecture, mint teal doors, terracotta trim, pale sandstone paving, rooftop antennas, succulent planters, distant blue sea and hazy coastal cliffs. Two charming compact service robots in teal and coral protective armor with smooth ivory helmets, dark glass visors and small luminous eyes, carrying playful chunky sporting blasters. Believable physically based painted metal, subtle edge wear, rubber joints, soft sunlight and lovely ambient occlusion, high-end stylized game rendering, strong silhouettes, sophisticated colors. Camera slightly low, foreground coral robot on right, teal robot at middle left, sculptural cover blocks in middle, attractive spacious courtyard. Friendly competitive energy, not military realism, no blood. Real spatial depth and material quality, not a flat illustration, not voxel Minecraft. Clear readable bright daytime scene. No words, no logos, no UI or watermarks. This will be used as the game's in-game menu artwork.

### Limestone surface

Use case: stylized-concept. Asset type: seamless tileable game material albedo texture, square. A high quality warm ivory limestone and lime plaster surface for a sunny Mediterranean low-poly 3D game courtyard wall. Fine natural mineral grain, subtle hand-trowelled irregularity and occasional small pores, restrained cream and sandy pale warm beige colors, uniformly lit orthographic straight-on flat surface with no directional shadow, no objects, no large cracks, no text, no border. All four edges seamless. Realistic material detail but clean stylized art direction. A physically based renderer will add lighting so do not bake highlights or ambient shadows. Entire frame filled by the material, enough subdued detail to make beautiful close-up game walls.

### Coastal sky panorama

`web/art/coastal-sky.webp` is a third original image_gen asset, mapped to the game's sky sphere. Prompt:

Use case: stylized-concept. Asset type: seamless horizontal 360-degree equirectangular environment panorama for an interactive 3D game, 2:1 landscape. A sunny Mediterranean coastal horizon: soft blue sky fills the upper 75 percent, a handful of delicate small white cumulus clouds with convincing volume and sunlit edges, distant hazy pale limestone sea cliffs and tiny low-poly ivory coastal buildings on distant ridges along the horizon, gentle turquoise sea across the lower 20 percent. Premium stylized low-poly game rendering with believable atmospheric depth and light, friendly warm afternoon, subdued natural pastel colors. Nothing in the foreground. The horizon is level, tiny and far away. No fisheye distortion, no borders, no text, no logo, no watermarks. Left and right edges must join seamlessly. This is an unobtrusive backdrop behind an actual game courtyard, not a detailed key art scene.

## Runtime and controls

Build with `npm run build`; `tools/build-openstrike.mjs` bundles the tracked client sources. Game artwork is local and needs no external CDN. All controls, settings, room invitations and results are inside the arena. Device-pixel resolution is capped at 8,294,400 pixels, static meshes are batched by material, effects use a bounded pool, and low-power mode disables shadow maps. Reduced motion removes weapon bob and muzzle flashes.

The service in the separate `myelin-openstrike` repository provides Rookie, Standard and Veteran bot input policies. Bots navigate the existing arena and submit ordinary native inputs; the simulation, replay binary and Myelin application profile are unchanged. This is off-chain native replay verification, not CKB settlement. Old verified exports retain their original binary identity.

The client includes bounded reconnect backoff, stale-frame rejection, neutral input on blur/menu/disconnect, single-pointer touch ownership, input release on pointer cancellation, editable FOV/sensitivity/audio, and an explicit touch-controls option for hybrid devices. Completed practice rounds can be restarted directly. Duel rematches create a new invitation room; they do not silently enroll the previous opponent.

## Checks

Run `npm test` for model, geometry and platform checks. Run `node --test tests/practice.mjs` in the runtime repository for bot policies and obstacle routing. Run `STORE_URL=http://127.0.0.1:19100 node tests/live-openstrike.mjs` against an isolated store with the real native runtime for signed login, two-player combat, rejected invalid inputs, account isolation and verified replay export.

### Release validation (2026-10-24)

- UTXOPlay model/platform suite: 96 tests passed. Shipped-controller DOM tests cover fast clicks, released inputs on blur/disconnect/cancel, pointer ownership, stored touch settings and stale snapshots. All nine shared game menus retain their in-viewport controls.
- Real native integration: signed CKB login, two-player WebSocket duel, a completed elimination, persisted results, rejected malformed inputs, outsider isolation and verified Myelin export. Three real bot matches (Rookie/Standard/Veteran) completed, retained statistics after refresh, and created rematches.
- Runtime tests: three bot-policy/navigation tests; native live/replay equality, full 90-second draw, forged/tampered export rejection and oversized tape rejection. Navigation geometry equals the native bridge's exported map.
- Browser inspection: 1920×1080, 2560×1080, 2560×1440, 390×844 and 844×390 filled the viewport without horizontal overflow or fatal renderer errors. A same-origin 3840×2160 frame and a direct 3840×2160 viewport validated actual 4K canvas sizing, enlarged HUD bounds and the 8,294,400 backing-pixel cap. Touch play and portrait weapon framing were inspected in the real client.

These checks do not establish a sustained GPU frame-rate guarantee or physical-device coverage. The in-app browser throttles rendering, so its FPS readout is not a representative performance benchmark. Three difficulty policies were exercised against scripted inputs; extended human playtesting remains useful for further balance tuning.

### Deployment

Published as UTXOPlay 0.20.0 and `myelin-openstrike:0.2.0`. Public asset responses match the built client byte-for-byte. The production signed-login/two-player combat test passed, and the downloaded production export was verified again locally with the retained binary pair. Store and runtime health checks pass; the other game containers were not recreated. A consistent SQLite backup and OpenStrike data archive were retained before replacement.
