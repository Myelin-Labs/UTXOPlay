// Original synthesized interaction effects; background recording credited in ASSETS.md.
const music = new Audio("/games/sling/assets/music.mp3");
music.loop = true;
music.volume = 0.3;
music.preload = "none";
const KEY = "skyward:audio";
let saved;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch {}
let ctx, master, enabled = saved?.enabled !== false;
let level = Number.isFinite(saved?.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.3;
let playing = false, request = 0;
music.volume = level;
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({enabled, volume: level})); } catch {}
}
export function audioState() { return {enabled, playing, volume: level}; }
function notify() { document.dispatchEvent(new CustomEvent("skyward:audio", {detail: audioState()})); }
export async function startSound() {
  if (!enabled || document.hidden) return;
  const id = ++request;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!master) { master = ctx.createGain(); master.connect(ctx.destination); master.gain.value = level; }
    // Both calls originate in the gesture, before yielding to a promise.
    await Promise.all([ctx.resume(), music.play()]);
    if (id !== request) return;
    playing = true;
  } catch { if (id === request) playing = false; }
  if (!enabled || document.hidden) { music.pause(); playing = false; }
  notify();
}
export async function toggleSound() {
  // A blocked/failed playback can be retried directly from this button.
  if (enabled && !playing) { await startSound(); return enabled; }
  enabled = !enabled;
  persist();
  if (enabled) await startSound();
  else { request++; music.pause(); playing = false; if (ctx) await ctx.suspend(); notify(); }
  return enabled;
}
export function volume(v) {
  level = Math.max(0, Math.min(1, v));
  music.volume = level;
  if (master) master.gain.setTargetAtTime(level, ctx.currentTime, 0.03);
  persist();
  notify();
}
export function sound(kind = "move") {
  if (!enabled || !playing || !ctx || document.hidden) return;
  const now = ctx.currentTime;
  const notes =
    kind === "win"
      ? [523.25, 659.25, 783.99, 1046.5]
      : kind === "launch"
        ? [260, 520]
        : kind === "hit"
          ? [160, 90]
          : [440, 660];
  notes.forEach((freq, i) => {
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      f = ctx.createBiquadFilter();
    o.type = kind === "hit" ? "triangle" : "sine";
    o.frequency.setValueAtTime(freq, now + i * 0.065);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.65,
      now + i * 0.065 + 0.16,
    );
    f.type = "lowpass";
    f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, now + i * 0.065);
    g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.065 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.28);
    o.connect(f).connect(g).connect(master);
    o.start(now + i * 0.065);
    o.stop(now + i * 0.065 + 0.3);
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    request++; music.pause(); playing = false;
    ctx?.suspend().catch(() => {}); notify();
  } else if (enabled && ctx) void startSound();
});
music.addEventListener("error", () => { playing = false; notify(); });
