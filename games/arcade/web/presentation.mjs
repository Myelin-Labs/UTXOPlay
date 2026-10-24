import {brickPoint} from './prism-engine.mjs';
// Presentation and input helpers. Never mutate a signed/predicted game state.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
export const roadPoint = (lane, y) => {
  const scale = (y + 100) / 1100;
  return { x: 500 + (lane - 1) * 290 * scale, y: 180 + scale * 760, scale };
};
const direction = {4: 0, 2: 1, 8: 2, 1: 3};

// A drag steers relative to its starting position, so a finger never teleports
// the target. Only the owner pointer can change it; each swipe commits once.
export class BoardGesture {
  constructor(kind) { this.kind = kind; this.clear(); }
  clear() { this.owner = null; this.target = null; this.start = null; this.committed = false; }
  begin(pointer, x, y, playerX) {
    if (this.owner !== null) return false;
    this.owner = pointer; this.start = {x, y, playerX}; this.target = playerX; this.committed = false;
    return true;
  }
  move(pointer, x, y) {
    if (pointer !== this.owner || !this.start) return 0;
    const dx = x - this.start.x, dy = y - this.start.y;
    if (this.kind === 'prism-breaker' || this.kind === 'starfall') {
      this.target = clamp(this.start.playerX + dx, 0, 1000); return 0;
    }
    if (this.committed || Math.max(Math.abs(dx),Math.abs(dy)) < 45) return 0;
    // Vertical scrolling-like gestures must never change a racing lane.
    if (this.kind === 'drift-run' && Math.abs(dy) >= Math.abs(dx)) { this.committed = true; return 0; }
    this.committed = true;
    return Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 2 : 1 : dy > 0 ? 8 : 4;
  }
  end(pointer) { if (pointer === this.owner) this.clear(); }
}

export function runSummary(game, previousBest) {
  const duration = `${Math.floor(game.tick / 1800)}:${String(Math.floor(game.tick / 30) % 60).padStart(2,'0')}`;
  const tips = {
    'prism-breaker': 'Break crystals to recharge. Q / E bends a falling ball back into play.',
    'neon-coil': 'Grow to 9 segments, then close a circuit around an empty tile to cash in its area.',
    starfall: 'Hold W to capture a volley, release to reflect it. Leave room to dodge during cooldown.',
    'drift-run': 'Leave your echo on a ring, then spend 3 charge on an Overdrive through traffic.'
  };
  return {title: game.kind==='prism-breaker'&&game.over&&game.level===24&&!game.cells.some(Boolean)?'Spectrum restored!': game.tick >= (game.kind==='prism-breaker'?108000:18000) ? (game.kind==='prism-breaker'?'Campaign time limit reached!':'Ten minutes complete!') : game.score > previousBest ? 'New device best!' : 'One more run?', duration, tip: tips[game.kind]};
}

export class InputBuffer {
  constructor(kind) { this.kind = kind; this.held = new Map(); this.queue = []; this.tapBits = 0; }
  press(source, bit, game) {
    if (this.held.has(source)) return;
    this.held.set(source, bit);
    if ((this.kind === 'prism-breaker' && (bit === 4 || bit === 8 || bit === 16)) || (this.kind === 'drift-run' && bit === 16)) this.tapBits |= bit;
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
    const tapped=this.tapBits;this.tapBits=0;
    if (this.kind === 'neon-coil') return this.queue[0] || 0;
    if (this.kind === 'drift-run') return (game.cooldown <= 1 ? this.queue.shift() || 0 : 0) | ([...this.held.values()].some(bit => bit === 16) ? 16 : 0) | tapped;
    return [...this.held.values()].reduce((bits, bit) => bits | bit, tapped);
  }
  stepped(before, after) {
    if (this.kind === 'neon-coil' && (before.trail[0][0] !== after.trail[0][0] || before.trail[0][1] !== after.trail[0][1])) this.queue.shift();
  }
  clear() { this.held.clear(); this.queue = []; this.tapBits = 0; }
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
    if(after.refractions>before.refractions)events.push({type:'bounce',x:after.bodies[0]?.x||after.x,y:after.bodies[0]?.y||400,label:after.refract_dir<0?'REFRACT ↖':'REFRACT ↗'});
    before.cells.forEach((v, i) => {
      if (v && !after.cells[i]) events.push({type: 'brick', ...brickPoint(before,i), value: after.score - before.score});
    });
    const a = before.bodies[0], b = after.bodies[0];
    if (a && b && a.vy > 0 && b.vy < 0 && b.y >= 540 && after.lives === before.lives) events.push({type: 'bounce', x: b.x, y: 563});
  } else if (kind === 'neon-coil' && after.score > before.score) {
    const loop=after.specials>before.specials;
    events.push({type:'collect',x:(loop?after.trail[0][0]:before.x)*50+25,y:(loop?after.trail[0][1]:before.y)*50+25,value:after.score-before.score,...(loop?{label:`CIRCUIT · ${after.loop_area} TILES`}:{})});
  } else if (kind === 'starfall') {
    if(after.energy>before.energy)events.push({type:'collect',x:after.x,y:880,value:5});
    if(after.specials>before.specials)events.push({type:'collect',x:after.x,y:850,label:`RETURN FIRE · ${before.energy} SHOTS`});
    if(after.ability_lock>before.ability_lock)events.push({type:'bounce',x:after.x,y:880,label:'SHIELD OVERHEATED · DODGE'});
    if (after.level === before.level) {
      const bounce = before.bodies.some(b => b.tag === 1 && (b.x + b.vx < 45 || b.x + b.vx > 955));
      for (const b of before.bodies.filter(b => b.tag === 1)) {
        const x = b.x + (bounce ? -b.vx : b.vx), y = b.y + (bounce ? 24 : 0);
        if (!after.bodies.some(c => c.tag === 1 && c.x === x && c.y === y)) events.push({type: 'enemy', x, y, value: 20});
      }
    }
    if (after.cooldown === 7 && before.cooldown <= 1) events.push({type: 'shot', x: after.x, y: 860});
  } else if (kind === 'drift-run') {
    if(after.specials>before.specials)events.push({type:'collect',...roadPoint(after.x,830),label:'OVERDRIVE · BREAK THROUGH'});
    if(after.score-before.score>=15){
      const speed=9+Math.min(after.level,14)+(after.ability_ticks?7:0);
      const echo=after.echo_ticks>0&&before.bodies.some(b=>b.tag===2&&b.x===after.echo_lane&&b.x!==after.x&&Math.abs(b.y+speed-830)<48);
      const close=before.bodies.some(b=>b.tag===1&&b.y<830&&b.y+speed>=830&&Math.abs(b.x-after.x)===1);
      events.push({type:'collect',...roadPoint(echo?after.echo_lane:after.x,830),value:after.score-before.score,label:echo?'ECHO PICKUP':close?'CLOSE PASS':undefined});
    }
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
