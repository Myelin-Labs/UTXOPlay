// Presentation scheduling only: native ticks, inputs and replay rules are untouched.
const elements = new Map();
export function setText(id, value) {
  let el = elements.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (el) elements.set(id, el);
  }
  const text = String(value);
  if (el && el.textContent !== text) el.textContent = text;
}
export function readQuality() {
  try {
    return localStorage.getItem("utxoplay:quality") || "auto";
  } catch {
    return "auto";
  }
}
export class ResolutionBudget {
  constructor(max = 2) {
    this.max = max;
    this.ratio = max;
    this.slow = 0;
    this.fast = 0;
  }
  sample(ms, quality = "auto") {
    if (quality !== "auto") {
      this.ratio = quality === "low" ? Math.min(1, this.max) : this.max;
      this.slow = this.fast = 0;
      return this.ratio;
    }
    this.slow = ms > 24 ? this.slow + 1 : Math.max(0, this.slow - 2);
    this.fast = ms < 18 ? this.fast + 1 : 0;
    if (this.slow >= 90) {
      this.ratio = Math.max(0.75, this.ratio - 0.25);
      this.slow = this.fast = 0;
    }
    if (this.fast >= 600) {
      this.ratio = Math.min(this.max, this.ratio + 0.25);
      this.fast = 0;
    }
    return this.ratio;
  }
}
export function startRenderLoop(
  draw,
  { active = () => true, maxFps = 60, onResolution } = {},
) {
  let handle = 0,
    last = 0,
    scheduled = 0,
    stopped = false,
    quality = readQuality(),
    measure = 0,
    frames = 0,
    cpu = 0;
  const budget = new ResolutionBudget(
    Math.min(globalThis.devicePixelRatio || 1, 2),
  );
  let ratio = budget.ratio;
  function tick(now) {
    handle = 0;
    if (stopped || document.hidden) return;
    handle = requestAnimationFrame(tick);
    const playing = active(),
      interval = 1000 / (playing ? maxFps : 30);
    if (scheduled && now + 0.25 < scheduled) return;
    scheduled = scheduled ? scheduled + interval : now + interval;
    if (scheduled < now) scheduled = now + interval;
    const delta = last ? Math.min(now - last, 50) : 1000 / 60;
    last = now;
    const next =
      playing || quality !== "auto"
        ? budget.sample(delta, quality)
        : budget.ratio;
    if (next !== ratio) {
      ratio = next;
      onResolution?.(ratio);
    }
    const start = performance.now();
    draw(now, delta, ratio);
    cpu += performance.now() - start;
    frames++;
    if (now - measure >= 1000) {
      document.documentElement.dataset.renderFps = String(
        Math.round((frames * 1000) / (now - measure)),
      );
      document.documentElement.dataset.renderMs = (cpu / frames).toFixed(2);
      document.documentElement.dataset.renderScale = ratio.toFixed(2);
      measure = now;
      frames = cpu = 0;
    }
  }
  function visibility() {
    cancelAnimationFrame(handle);
    handle = 0;
    last = scheduled = 0;
    measure = performance.now();
    frames = cpu = 0;
    if (!document.hidden && !stopped) handle = requestAnimationFrame(tick);
  }
  function qualityChange() {
    quality = readQuality();
    budget.slow = budget.fast = 0;
  }
  document.addEventListener("visibilitychange", visibility);
  addEventListener("storage", qualityChange);
  addEventListener("utxoplay:quality", qualityChange);
  visibility();
  return () => {
    stopped = true;
    cancelAnimationFrame(handle);
    document.removeEventListener("visibilitychange", visibility);
    removeEventListener("storage", qualityChange);
    removeEventListener("utxoplay:quality", qualityChange);
  };
}
export function startPolling(
  task,
  { interval = 5000, enabled = () => true } = {},
) {
  let timer,
    stopped = false,
    running = false;
  async function run() {
    if (stopped || running) return;
    clearTimeout(timer);
    running = true;
    try {
      if (!document.hidden && enabled()) await task();
    } catch {
    } finally {
      running = false;
      if (!stopped) timer = setTimeout(run, interval);
    }
  }
  function visible() {
    if (!document.hidden) void run();
  }
  document.addEventListener("visibilitychange", visible);
  timer = setTimeout(run, interval);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visible);
  };
}
