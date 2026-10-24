import test from "node:test";
import assert from "node:assert/strict";
import {
  guidePoints,
  flightMedal,
  pullVector,
  renderRatio,
  sceneRegion,
} from "../games/sling/web/presentation.mjs";
import { viewport, pointerInViewport } from "../shared/game-viewport.mjs";
test("Skyward pointer mapping survives wide, 4K and phone viewports with bounded backing memory", () => {
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1080],
    [2560, 1440],
    [3840, 2160],
    [390, 844],
    [844, 390],
  ]) {
    const v = viewport(width, height, "sling"),
      rect = { left: 13, top: 27, width, height };
    for (const [x, y] of [
      [180, 360],
      [60, 460],
      [1000, 480],
    ]) {
      const p = pointerInViewport(
        rect.left + v.x + x * v.scale,
        rect.top + v.y + y * v.scale,
        rect,
        "sling",
      );
      assert.ok(Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
    }
    assert.ok(v.x >= 0 && v.y >= 0 && v.y + 560 * v.scale <= height);
    assert.ok(
      width * height * renderRatio(width, height, 2) ** 2 <= 4194304.001,
    );
  }
  assert.ok(
    viewport(844, 390, "sling").scale > 0.45,
    "landscape uses the available scene height",
  );
});
test("Skyward guide fades rapidly and stops before revealing a full trajectory", () => {
  const points = guidePoints(-116, 16);
  assert.ok(points.length > 3 && points.length <= 10);
  assert.ok(points.at(-1).alpha < 0.01);
  assert.ok(points.at(-1).x < 700);
  assert.ok(
    points.every(
      (p, i) =>
        p.radius > 0 && p.alpha >= 0 && (!i || p.alpha < points[i - 1].alpha),
    ),
  );
});
test("Skyward extreme pulls remain within native legal range", () => {
  assert.deepEqual(pullVector(64, 388), { dx: -116, dy: 28 });
  for (const x of [-10000, 0, 180, 9000])
    for (const y of [-10000, 0, 360, 10000]) {
      const { dx, dy } = pullVector(x, y);
      assert.ok(Number.isInteger(dx) && Number.isInteger(dy));
      assert.ok(
        dx <= -8 &&
          dx >= -120 &&
          dy >= -20 &&
          dy <= 100 &&
          Math.hypot(dx, dy) <= 120,
      );
    }
});
test("Skyward medal counts earned extra flights without penalizing unused inventory", () => {
  assert.deepEqual(flightMedal({ won: true, shots: 3, extra_used: 0 }), {
    used: 1,
    stars: 3,
  });
  assert.deepEqual(flightMedal({ won: true, shots: 4, extra_used: 2 }), {
    used: 2,
    stars: 2,
  });
  assert.deepEqual(flightMedal({ won: false, shots: 0, extra_used: 1 }), {
    used: 5,
    stars: 0,
  });
  assert.deepEqual(
    Array.from({ length: 12 }, (_, i) => sceneRegion(i + 1)),
    [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3],
  );
});
