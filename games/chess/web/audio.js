// Original synthesized interaction effects; background recording credited in ASSETS.md.
const music = new Audio("/games/chess/assets/music.mp3");
music.loop = true;
let master = 0.3;
try {
  const saved = localStorage.getItem("chess:volume");
  if (saved !== null && Number.isFinite(Number(saved)))
    master = Math.max(0, Math.min(1, Number(saved)));
} catch {}
music.volume = master;
export const savedVolume = () => master;
music.preload = "none";
let ctx,
  enabled = false;
export async function toggleSound() {
  enabled = !enabled;
  if (enabled) {
    try {
      ctx ??= new AudioContext();
      await ctx.resume();
      await music.play();
    } catch {
      enabled = false;
    }
  } else music.pause();
  return enabled;
}
export function volume(v) {
  if (!Number.isFinite(v)) return;
  master = music.volume = Math.max(0, Math.min(1, v));
  try {
    localStorage.setItem("chess:volume", String(master));
  } catch {}
}
export function sound(kind = "move") {
  if (!enabled || !ctx || !master || document.hidden) return;
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
    g.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, 0.12 * master),
      now + i * 0.065 + 0.008,
    );
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.065 + 0.28);
    o.connect(f).connect(g).connect(ctx.destination);
    o.start(now + i * 0.065);
    o.stop(now + i * 0.065 + 0.3);
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) music.pause();
  else if (enabled) music.play().catch(() => {});
});
