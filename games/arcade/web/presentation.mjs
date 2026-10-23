// Presentation and input helpers. Never mutate a signed/predicted game state.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
export const roadPoint = (lane, y) => {
  const scale = (y + 100) / 1100;
  return { x: 500 + (lane - 1) * 290 * scale, y: 180 + scale * 760, scale };
};
const direction = {4: 0, 2: 1, 8: 2, 1: 3};

export class InputBuffer {
  constructor(kind) { this.kind = kind; this.held = new Map(); this.queue = []; }
  press(source, bit, game) {
    if (this.held.has(source)) return;
    this.held.set(source, bit);
    if (this.kind === 'neon-coil') {
      const next = direction[bit];
      if (next === undefined) return;
      const last = this.queue.length ? direction[this.queue.at(-1)] : game.next_dir;
      if (next !== last && (next + 2) % 4 !== last && this.queue.length < 2) this.queue.push(bit);
    } else if (this.kind === 'drift-run' && (bit === 1 || bit === 2) && this.queue.length < 2) {
      this.queue.push(bit);
    }
  }
  release(source) { this.held.delete(source); }
  pulse(bit, game) { this.release('swipe'); this.press('swipe', bit, game); this.release('swipe'); }
  read(game) {
    if (this.kind === 'neon-coil') return this.queue[0] || 0;
    if (this.kind === 'drift-run') return game.cooldown <= 1 ? this.queue.shift() || 0 : 0;
    return [...this.held.values()].reduce((bits, bit) => bits | bit, 0);
  }
  stepped(before, after) {
    if (this.kind === 'neon-coil' && (before.trail[0][0] !== after.trail[0][0] || before.trail[0][1] !== after.trail[0][1])) this.queue.shift();
  }
  clear() { this.held.clear(); this.queue = []; }
}

// Match only physically adjacent entities of the same kind; spawns snap in.
export function previousBody(body, before) {
  let closest = null, distance = Infinity;
  for (const candidate of before.bodies) {
    if (candidate.tag !== body.tag) continue;
    const dx = candidate.x - body.x, dy = candidate.y - body.y;
    const d = dx * dx + dy * dy;
    if (Math.abs(dx) <= 40 && Math.abs(dy) <= 40 && d < distance) { closest = candidate; distance = d; }
  }
  return closest;
}

export function feedback(before, after) {
  const events = [];
  if (after.tick !== before.tick + 1) return events;
  const kind = after.kind;
  if (kind === 'prism-breaker') {
    before.cells.forEach((v, i) => {
      if (v && !after.cells[i]) events.push({type: 'brick', x: 70 + i % 8 * 110, y: 135 + Math.floor(i / 8) * 48, value: after.score - before.score});
    });
    const a = before.bodies[0], b = after.bodies[0];
    if (a.vy > 0 && b.vy < 0 && b.y >= 850 && after.lives === before.lives) events.push({type: 'bounce', x: b.x, y: 880});
  } else if (kind === 'neon-coil' && after.score > before.score) {
    events.push({type: 'collect', x: before.x * 50 + 25, y: before.y * 50 + 25, value: after.score - before.score});
  } else if (kind === 'starfall') {
    if (after.level === before.level) {
      const bounce = before.bodies.some(b => b.tag === 1 && (b.x + b.vx < 45 || b.x + b.vx > 955));
      for (const b of before.bodies.filter(b => b.tag === 1)) {
        const x = b.x + (bounce ? -b.vx : b.vx), y = b.y + (bounce ? 24 : 0);
        if (!after.bodies.some(c => c.tag === 1 && c.x === x && c.y === y)) events.push({type: 'enemy', x, y, value: 20});
      }
    }
    if (after.cooldown === 7 && before.cooldown <= 1) events.push({type: 'shot', x: after.x, y: 860});
  } else if (kind === 'drift-run' && after.score - before.score >= 25) {
    events.push({type: 'collect', ...roadPoint(after.x, 830), value: 25});
  }
  if (after.lives < before.lives) events.push({type: 'damage', x: kind === 'neon-coil' ? before.trail[0][0] * 50 + 25 : kind === 'drift-run' ? roadPoint(before.x, 830).x : after.x, y: kind === 'neon-coil' ? before.trail[0][1] * 50 + 25 : 880});
  if (after.level > before.level) events.push({type: 'wave', x: 500, y: 500, value: after.level});
  return events;
}

export class EffectPool {
  constructor(limit = 180) { this.limit = limit; this.items = []; }
  emit(event, reduced = false) {
    if (event.type === 'shot') return;
    const count = reduced ? 0 : event.type === 'damage' ? 28 : event.type === 'bounce' ? 8 : 18;
    for (let i = 0; i < count; i++) {
      const angle = i * 2.39996, speed = 90 + i % 7 * 35;
      this.items.push({x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0, life: .35 + i % 5 * .09, type: event.type, size: 2 + i % 4});
    }
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
  }
  advance(seconds) {
    for (const p of this.items) { p.x += p.vx * seconds; p.y += p.vy * seconds; p.age += seconds; }
    this.items = this.items.filter(p => p.age < p.life);
  }
  clear() { this.items = []; }
}
