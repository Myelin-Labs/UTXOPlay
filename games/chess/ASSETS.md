# Asset provenance

## Conservatory refresh — 2026-10-24

Generated with the built-in OpenAI ImageGen tool. Generation mode for the room and cover; generation followed by an image-edit pass for the transparent piece atlas. No external artwork supplied. WebP conversion preserves alpha; source images remain in the generation archive. The playable scene uses a square DOM board and these 2.5D sprites, not a continuously rendered 3D scene.

- `web/assets/conservatory.webp`: background, generated from the room prompt below.
- `web/assets/porcelain-pieces.webp`: ivory/jade Staunton atlas, 2172 × 724, six equal columns and two rows. Column order king, queen, bishop, knight, rook, pawn. The top row is White.
- `../../public/assets/chess-cover.webp`: store and loading-screen key art, 1440 pixels wide.
- Previous study assets are retained for existing release references; the new scene loads the Conservatory assets only.

### Room prompt

Use case: stylized-concept. Asset type: premium chess game full-screen environment background, 16:9 landscape. A tranquil sunlit botanical conservatory chess salon with arched old windows, leafy climbing plants, a distant soft garden, warm pale plaster, gently aged brass and honey oak. A broad beautiful oak tabletop occupies the lower half and a clear central area, with soft dappled daylight and convincing wood grain. Sophisticated slightly stylized physically based 3D rendering, tactile believable materials, warm ivory and sage jade palette, peaceful luxurious atmosphere. Rich detail concentrated at left and right edges: a small ceramic tea cup on one side, a brass desk lamp and books on the other, gorgeous potted ferns. Keep the middle 60 percent calm and uncluttered, this space will sit behind a playable chessboard. Camera above the desk looking slightly downward, real spatial depth, refined soft ambient occlusion. No chessboard or chess pieces anywhere, no people, no words, no typography, no logos, no watermark. High quality original game environment, not a UI mockup.

### Piece atlas prompt

Use case: stylized-concept. Asset type: production chess-piece sprite atlas with genuinely transparent alpha background, wide landscape 3:1 aspect ratio. Exactly 6 equally sized columns and 2 equally sized rows, 12 complete isolated chess pieces, one piece centered in each equal cell, ample empty padding at all cell edges, no clipping and absolutely no overlap between cells. Top row left to right KING, QUEEN, BISHOP, KNIGHT, ROOK, PAWN in warm ivory glazed ceramic. Bottom row the same order KING, QUEEN, BISHOP, KNIGHT, ROOK, PAWN in deep jade green glazed ceramic. Beautiful premium playful sculptural Staunton chess set, softly rounded low-poly forms with tangible ceramic surface, tasteful slim brushed-brass rings at each base. Clearly distinguishable classical silhouettes: king small cross crown, queen pointed open crown, bishop diagonal mitre slit, knight lovely rounded carved horse head, rook crenellated castle top, pawn smooth sphere. Sophisticated high-end indie game art, not emoji and not flat vector. Orthographic three-quarter front view from slightly above, identical camera angle and lighting for every piece. Soft upper-left daylight, subtle realistic highlights, tiny soft contact shadow within each sprite footprint. Each chess piece entirely within its own cell and uses roughly 70 percent cell width and 82 percent cell height; consistent baseline inside each row. No board, no environment, no checker pattern, no words, no labels, no logos, no watermark. Preserve actual transparent background.

### Piece edit prompt

Fix this chess sprite atlas for production. Preserve the exact 6-column by 2-row arrangement, ivory top row and jade bottom row, same Staunton piece identities and pleasing ceramic materials. Remove ALL the red, yellow and blocky pale fringes around the silhouettes. Give every piece beautifully clean smooth anti-aliased alpha edges on a genuinely transparent background, with no color contamination. The king's cross at top is clipped: scale each piece down uniformly within its own cell so every complete piece has at least 8 percent cell padding on all sides. Equal grid cells, consistent baseline in each row, no overlap. Do not add text or board. The exact usable sprite atlas is the output, not an image of the atlas.

### Cover prompt

Use case: stylized-concept. Original premium browser chess game cover artwork. Landscape 16:9. A gorgeous real-looking Staunton chessboard on a honey oak desk in a sunlit botanical conservatory. Close low three-quarter camera with strong beautiful composition. Small sophisticated glazed ivory and deep jade ceramic chess pieces with thin brushed brass base rings, recognizable complete king, queen, bishop, knight, rook and pawn silhouettes. Elegant slightly stylized physically based 3D, subtle handmade imperfections, luxurious tactile ceramic, elegant horse carving, soft cinematic depth of field. Beautiful sage-green and cream chessboard squares, walnut board edge, graceful fern shadows, arched windows and foliage in background. Inviting peaceful warm daylight, polished cozy strategy game key art. Absolutely no words, labels, logos, or watermark. Entire piece silhouettes fully in frame. Professional art direction, not a UI mockup.

## Chess analysis dependency

[chess.js 1.4.0](https://github.com/jhlywa/chess.js) supplies local move generation and SAN/PGN notation under BSD-2-Clause. Its license is shipped in `web/licenses/CHESS-JS.txt`. The bounded training search is original application code. The native Myelin Chess service remains authoritative for every move, game outcome, session and signed replay. Training levels have no advertised Elo rating. No chess rules, native executable or application profile were changed.


Application code and original synthesized interaction sound code: MIT, Myelin Labs. This does not change the license of the following music recording.

## Music

**“Evening Fall (Harp)” — Kevin MacLeod (incompetech.com)**

- Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100236
- Download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Evening%20Fall%20-%20Harp.mp3
- Local file: `web/assets/music.mp3`
- Licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/
- Unmodified recording, played at user-controlled volume and looped. Attribution is included here and in the in-game credits dialog.

## Original visual assets

Produced for this project with the built-in OpenAI ImageGen tool on 2026-10-11. Original generated visual assets are distributed with this project under MIT; no third-party game images were supplied as inputs. Alpha is preserved for sprite sheets. The following briefs record the production direction.

### `web/assets/study.png`

Use case: stylized-concept. Finished high-end browser chess game environment background, landscape. A refined, warm study at twilight, quiet old-world chess club, walnut wood panels, deep bottle-green walls, muted brass lamps, rain-streaked tall window with softly blurred garden, a few leather-bound books. Painterly cinematic concept art with tangible materials, rich ambient occlusion, warm pools of amber light, restrained palette. Straight-on wide scene, dark uncluttered center behind an interactive chessboard; objects clustered at far left/right and top. No board, pieces in center, text, logos or watermarks.

### `web/assets/pieces.png`

Transparent production chess sprite sheet, exactly 6 columns × 2 rows, 12 separated pieces in equal cells. Top row: ivory king, queen, bishop, knight, rook, pawn. Bottom row: dark ebony versions in the same order. Carved Staunton set, three-quarter frontal orthographic view, polished ivory and dark walnut with antique gold base rings. Warm upper-left studio light, readable silhouettes, carved horse heads, close contact shadows. No board, backdrop, labels, text or extra pieces. Rendered original dimensions: 2172 × 724.

## Blue Hour Club — 2026-10-24

`web/assets/blue-hour.webp` is an original image generated with the built-in OpenAI ImageGen tool, then encoded as WebP (292,878 bytes; use the SHA256SUMS manifest for exact integrity). It replaces the active conservatory backdrop; the ceramic piece atlas remains the existing original generated artwork. No third-party reference images were used.

### Final environment prompt

Use case: stylized-concept. Asset type: premium full-screen chess game environment background, 16:9 landscape, very high resolution. A luxurious intimate contemporary chess salon at blue hour overlooking a rain-washed Japanese courtyard through immense arched bronze-framed windows. Exceptional physically based cinematic game environment art, sophisticated realistic materials, softly tactile, artisanal. Smoked walnut tabletop stretches across the entire foreground and central 70 percent, empty and uncluttered where an interactive chessboard will be overlaid. At the far left a softly glowing alabaster sculptural lamp and a small tea cup; far right a fern in an exquisite ceramic pot and a few beautiful books. Deep petrol teal shadows, champagne brass details, warm ivory light against cool blue rainy garden, controlled atmospheric depth, natural balanced light. Camera looking gently down toward the broad table with level horizon. Compose delicate narrative details toward outer edges, central area quiet. No chessboard, no chess pieces, no people, no text, no letters, no logos, no UI. Truly refined AAA-quality architectural visualization, not flat illustration.

## Stockfish opponent

The actual Stockfish.js 17.1 Lite single-thread engine is distributed unmodified under GPLv3. See `web/engine/SOURCE.md`, `Copying.txt`, `AUTHORS` and the corresponding-source archive (including the hash-verified Lite neural network). The application remains an original game by Arthur Zhang, using separately attributed engine dependencies.
