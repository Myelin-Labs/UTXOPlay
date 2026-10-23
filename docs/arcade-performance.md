# Arcade rendering performance — store 0.8.2

This release caches the unchanged scenery and prism wall, uses an opaque main Canvas, skips settled paused frames, observes layout size instead of reading it every frame, and updates HUD text/attributes only when values change. Quality preferences are read on preference events rather than once per frame. The signed rules, input tapes, native binaries and save cadence are unchanged.

The background cache is rebuilt on backing-size, quality or reduced-motion changes. The brick cache is invalidated by cell values, including hits, new waves and new sessions. Both use the current backing resolution. There is one full-size raster cache plus a 43%-height brick layer for Prism Breaker; no growing cache of resolutions. At a 1200×1200 backing size this adds about 5.8 MB of RGBA storage (8.2 MB for Prism Breaker), trading bounded memory for less drawing. Existing DPR limits still apply.

## Measured native Canvas results

Same machine, same source states, 600 CSS pixels, DPR 2 (1200×1200 raster), full effects; 20 warmup frames plus 80 measured frames. Each sample includes a pixel readback to force raster completion. Snake uses 80 segments. The scene remains fixed while visual time advances, so this measures steady rendering rather than cache rebuild cost or full gameplay. These are native Canvas microbenchmarks, **not measured browser/GPU/mobile FPS**.

| Game | Previous median | Updated median | Reduction |
| --- | ---: | ---: | ---: |
| Prism Breaker | 3.766 ms | 0.355 ms | 90.6% |
| Neon Coil | 4.182 ms | 1.957 ms | 53.2% |
| Starfall | 4.058 ms | 1.821 ms | 55.1% |
| Drift Run | 9.950 ms | 0.480 ms | 95.2% |

Full DPR 1/2 medians and p95 measurements are in `arcade-performance-results.json`. Dynamic pixel comparisons include simulation updates, removed bricks, session reset, DPR changes, resizing, low quality and reduced motion. Three games are pixel-identical to the reference in these checks; Prism Breaker's worst mean channel difference is 0.00416 / 255 (minor compositing rounding). Sixty consecutive settled paused frames issue no drawing; resize and new effects correctly wake rendering. The ResizeObserver path reads layout once on construction and uses observer updates thereafter. The real-runtime DOM flow harness also verifies an idle HUD does not rewrite unchanged attributes.

## Server and delivery observations

A read-only production sample showed about 11 GiB available memory, zero current memory pressure, load averages around 0.17–0.18, store CPU 0.03% / 51 MiB and arcade CPU 0.00% / 46 MiB. A warmed loopback health request inside the store container measured a 2.43 ms median across ten samples. These are idle observations, not capacity or load-test results. Public request timings varied with network/TLS setup; no server capacity tuning or infrastructure change was justified. Existing compressed delivery, image caching and lazy marketplace/wallet loading remain in place.

## Reproduce

Install optional test tools outside the app's production dependency tree:

```sh
npm install --prefix /tmp/arcade-test --no-audit --no-fund @napi-rs/canvas jsdom
mkdir -p artifacts/arcade-performance/baseline
git show 1a7362d:games/arcade/web/renderer.mjs > artifacts/arcade-performance/baseline/renderer.mjs
git show 1a7362d:games/arcade/web/presentation.mjs > artifacts/arcade-performance/baseline/presentation.mjs
ARCADE_TEST_MODULES=/tmp/arcade-test/node_modules RENDERER=artifacts/arcade-performance/baseline/renderer.mjs BENCH_OUTPUT=artifacts/arcade-performance/baseline node tests/arcade-render-bench.mjs
ARCADE_TEST_MODULES=/tmp/arcade-test/node_modules node tests/arcade-render-bench.mjs
ARCADE_TEST_MODULES=/tmp/arcade-test/node_modules node tests/arcade-render-check.mjs
npm test
npm run build
```

Run `tests/arcade-flow.mjs` for each game against an isolated real runtime as documented in `arcade-release.md`. Browser attachment has been unavailable in this session; native pixel comparisons and DOM harnesses do not replace device-level frame pacing, memory or touch testing.

Deploy only `utxoplay-store` with image `utxoplay:0.8.2`, preserving the arcade image and data. The previous 0.8.1 store image remains the rollback target.
