// Presentation-only helpers. Native flight traces remain authoritative.
export const art = {
  worlds: "/games/sling/assets/garden-worlds.webp",
  sprites: "/games/sling/assets/garden-sprites.webp",
};
export function guidePoints(dx, dy) {
  const points = [];
  let x = 180000,
    y = 360000,
    vx = -dx * 135,
    vy = -dy * 135;
  for (let i = 0; i < 64; i++) {
    vy += 110;
    x += Math.trunc(vx / 2);
    y += Math.trunc(vy / 2);
    if (y > 460000) break;
    if (i % 7 === 0)
      points.push({
        x: x / 1000,
        y: y / 1000,
        alpha: 0.68 * (1 - i / 64) ** 2,
        radius: 3.2 - i / 40,
      });
  }
  return points;
}
export function flightMedal(game) {
  const used = Math.max(0, 4 + (game.extra_used || 0) - game.shots);
  return { used, stars: game.won ? (used <= 1 ? 3 : used <= 2 ? 2 : 1) : 0 };
}
export function sceneRegion(level) {
  return Math.max(0, Math.min(3, Math.floor((Number(level || 1) - 1) / 3)));
}
export function renderRatio(width, height, ratio) {
  return Math.min(ratio, Math.sqrt(4194304 / Math.max(1, width * height)));
}
export function pullVector(x, y) {
  let dx = Math.min(-8, Math.max(-120, Math.round(x - 180))),
    dy = Math.min(100, Math.max(-20, Math.round(y - 360)));
  const n = Math.hypot(dx, dy);
  if (n > 120) {
    dx = Math.trunc((dx * 120) / n);
    dy = Math.trunc((dy * 120) / n);
  }
  return { dx, dy };
}
