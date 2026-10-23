import { startRenderLoop, startPolling, setText } from "./performance.mjs";
import { toggleSound, volume, sound, startSound, audioState } from "./audio.js?v=0.9.0";
const $ = (s) => document.querySelector(s),
  canvas = $("#world"),
  ctx = canvas.getContext("2d");
let selectedPower = "normal";
let data,
  busy = false,
  drag = null,
  flight = null,
  particles = [],
  toastTimer;
let effects = [],
  shake = 0,
  aim = null,
  hovered = -1,
  hiddenAt = 0;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
$("#gentle-effects").checked = reducedMotion.matches;
const gentle = () => $("#gentle-effects").checked;
function aimFromControls() {
  const angle = (+$("#angle").value * Math.PI) / 180,
    power = +$("#power").value * 1.18;
  return {
    dx: -Math.max(8, Math.round(Math.cos(angle) * power)),
    dy: Math.round(Math.sin(angle) * power),
  };
}
function feedback(t) {
  setText("flight-status", t);
}
function impact(x, y, kind, hp) {
  const colors =
    kind === "wood"
      ? ["#ad7138", "#e6bd76", "#735133"]
      : kind === "stone"
        ? ["#73868b", "#d7e3d8", "#485a63"]
        : ["#ffe899", "#ffffdc", "#99d6a1"];
  const n = gentle() ? 6 : 24;
  for (let i = 0; i < n; i++) {
    const angle = (i * Math.PI * 2) / n;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * (2 + Math.random() * 4),
      vy: Math.sin(angle) * 4 - 2,
      life: 40 + Math.random() * 15,
      color: colors[i % 3],
      size: kind === "sprite" ? 3 : 3 + Math.random() * 5,
      fragment: kind !== "sprite",
      rotation: Math.random() * 6,
    });
  }
  effects.push({ x, y, life: 45, kind: "ring", color: colors[1] });
  effects.push({
    x,
    y: y - 22,
    life: 70,
    kind: "text",
    text: hp > 0 ? "CRACK!" : kind === "sprite" ? "+500 · FREED!" : "+100",
    color: kind === "sprite" ? "#fff7bb" : "#ffffff",
  });
  shake = gentle() ? 0 : 8;
  feedback(
    hp > 0
      ? "Stone cracked — one more hit!"
      : kind === "sprite"
        ? "Sprite freed! +500"
        : `${kind === "wood" ? "Wood" : "Stone"} cleared! +100`,
  );
}
function beginFlight(replay = false) {
  if (!data.game.trace.length) return;
  const earned =
    data.game.hits.reduce(
      (n, h) =>
        n +
        (h[2] <= 0
          ? data.game.targets[h[1]].kind === "sprite"
            ? 500
            : 100
          : 0),
      0,
    ) + (data.game.won ? data.game.shots * 250 : 0);
  flight = {
    start: performance.now(),
    fired: new Set(),
    speed: replay ? +$("#replay-speed").value : 1,
    replay,
    score: data.game.score - earned,
  };
  effects = [];
  particles = [];
  feedback(replay ? "Replaying your last flight" : "Pip is away!");
}
addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = performance.now();
  else if (flight && hiddenAt) {
    flight.start += performance.now() - hiddenAt;
    hiddenAt = 0;
  }
});
const bg = new Image();
bg.src = "/games/sling/assets/islands.webp";
const scenery = document.createElement("canvas");
scenery.width = 1100;
scenery.height = 560;
const sceneryContext = scenery.getContext("2d", { alpha: false });
let sceneryReady = false;
bg.onload = () => {
  sceneryContext.drawImage(bg, 0, 0, 1100, 560);
  sceneryReady = true;
};
if (bg.complete && bg.naturalWidth) bg.onload();
const sprites = new Image();
sprites.src = "/games/sling/assets/characters.webp";
async function api(path, body) {
  const r = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Myelin-Client": "game",
          },
          body: JSON.stringify(body),
        },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
function sprite(col, row, x, y, w, h, angle = 0) {
  if (!sprites.complete || !sprites.naturalWidth) return;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.drawImage(
    sprites,
    (col * sprites.width) / 4,
    (row * sprites.height) / 2,
    sprites.width / 4,
    sprites.height / 2,
    -w / 2,
    -h / 2,
    w,
    h,
  );
  ctx.restore();
}
function ui() {
  if (!data) return;
  const g = data.game;
  $("#targets-left").textContent =
    `${g.remaining} sprite${g.remaining === 1 ? "" : "s"} to free`;
  $("#replay-shot").disabled = busy || !!flight || !g.trace.length;
  $("#level").textContent = String(g.level).padStart(2, "0");
  $("#level-name").textContent = g.level_name;
  $("#total-levels").textContent = g.total_levels;
  $("#region").textContent = g.region;
  $("#journey").value = g.level - (g.won ? 0 : 1);
  $("#journey").max = g.total_levels;
  $("#journey-label").textContent = `${g.level} / ${g.total_levels} islands · ${g.region}`;
  if (selectedPower !== "normal" && !g.inventory[selectedPower]) selectedPower = "normal";
  for (const button of document.querySelectorAll("[data-power]")) {
    const kind = button.dataset.power;
    button.disabled = busy || !!flight || g.won || g.lost || (kind !== "normal" && !g.inventory[kind]);
    button.setAttribute("aria-pressed", String(kind === selectedPower));
    const count = button.querySelector(".item-count");
    if (count) count.textContent = g.inventory[kind];
  }
  $("#extra-flight").disabled = busy || !!flight || g.won || !g.inventory.extra;
  $("#extra-count").textContent = g.inventory.extra;
  $("#rescue-flight").hidden = !g.lost || !g.inventory.extra;
  $("#rescue-flight").disabled = busy || !!flight;
  $("#item-hint").textContent = selectedPower === "burst" ? "Bloom bomb · bursts on first impact, clearing nearby targets." : selectedPower === "pierce" ? "Star feather · breaks stone in one hit and keeps its speed." : "Choose a boost before launching. Each item refills on the next island or retry.";
  document.body.dataset.region = String(Math.floor((g.level - 1) / 3));
  $("#score").textContent = String(flight?.score ?? g.score).padStart(4, "0");
  $("#shots").textContent = "● ".repeat(g.shots) + "○ ".repeat(Math.max(0, 4 - g.shots));
  $("#level-result").hidden = !!flight || (!g.won && !g.lost);
  $("#launch").disabled = busy || !!flight || g.won || g.lost;
  $("#new").disabled = busy || !!flight;
  for (const id of ["angle", "power", "replay-speed"])
    $("#" + id).disabled = busy || !!flight;
  $("#continue").textContent = g.won
    ? g.level === g.total_levels
      ? "A new adventure ↗"
      : "Next island →"
    : "Try this island again ↻";
  $("#result-kicker").textContent = g.won
    ? "BEAUTIFULLY FLOWN"
    : "ONE MORE LITTLE TRY";
  $("#result-title").textContent = g.won
    ? g.level === g.total_levels
      ? "A sky full of stories."
      : "Garden cleared!"
    : "Find a different arc.";
  $("#result-copy").textContent = g.won
    ? g.level === g.total_levels
      ? "All twelve gardens are home again. Your adventure is ready to save."
      : "A new island is waiting on the horizon."
    : "The garden is patient. Pull a little higher, or aim for a support.";
  $("#session-short").textContent = data.session.id.slice(0, 12) + "…";
  $("#session-info").replaceChildren();
  for (const [k, v] of Object.entries(data.session)) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = String(v);
    $("#session-info").append(dt, dd);
  }
}
function burst(x, y) {
  for (let i = 0; i < 14; i++) {
    const angle = (i * Math.PI * 2) / 14;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * 2.4,
      vy: Math.sin(angle) * 2.4 - 1,
      life: 38,
      color: i % 2 ? "#ffd67b" : "#fff5d6",
    });
  }
}
function render(now, elapsed) {
  const delta = Math.min(2, elapsed / 16.667);
  ctx.clearRect(0, 0, 1100, 560);
  if (sceneryReady) ctx.drawImage(scenery, 0, 0);
  else {
    ctx.fillStyle = "#c5e5d9";
    ctx.fillRect(0, 0, 1100, 560);
  }
  if (!data) return;
  const region = Math.floor((data.game.level - 1) / 3);
  if (region) {
    ctx.fillStyle = ["", "#f6b85220", "#8580df26", "#10285666"][region];
    ctx.fillRect(0, 0, 1100, 560);
    if (region === 3) {
      ctx.fillStyle = "#fff5cacc";
      for (let i=0;i<26;i++) { ctx.beginPath(); ctx.arc(30+(i*137)%1040, 24+(i*43)%215, i%3===0?2:1, 0, Math.PI*2); ctx.fill(); }
    }
  }
  ctx.save();
  if (shake > 0) {
    ctx.translate(
      Math.sin(now * 0.15) * shake,
      Math.cos(now * 0.12) * shake * 0.5,
    );
    shake = Math.max(0, shake - delta * 0.8);
  }
  // Drifting motes keep the garden alive without altering simulation state.
  if (!gentle())
    for (let i = 0; i < 10; i++) {
      const x = (now * 0.009 + i * 117) % 1100,
        y = 140 + Math.sin(now * 0.0008 + i * 3) * 65 + i * 17;
      ctx.fillStyle = "#fff8cf66";
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 7);
      ctx.fill();
    }
  const g = data.game;
  let targets = g.targets,
    step = -1;
  if (flight) {
    step = Math.min(
      g.trace.length - 1,
      Math.floor(((now - flight.start) * flight.speed) / 8.333),
    );
    const world = g.world_trace[step];
    targets = g.targets.map((target, i) => ({
      ...target,
      y: world[i * 2],
      hp: world[i * 2 + 1],
    }));
    for (const hit of g.hits) {
      if (hit[0] <= step) {
        targets[hit[1]].hp = hit[2];
        if (!flight.fired.has(hit[1])) {
          flight.fired.add(hit[1]);
          const target = targets[hit[1]];
          if (g.last_power === "burst" && !flight.burst) {
            flight.burst = true;
            const [x,y] = g.trace[hit[0]].map(v => v / 1000);
            effects.push({x,y,life:45,kind:"bloom",color:"#ffdd91"});
            sound("win");
          }
          impact(
            (target.x + target.w / 2) / 1000,
            (target.y + target.h / 2) / 1000,
            target.kind,
            hit[2],
          );
          if (hit[2] <= 0) {
            flight.score += target.kind === "sprite" ? 500 : 100;
            $("#score").textContent = String(flight.score).padStart(4, "0");
          }
          sound("hit");
        }
      }
    }
    if (step === g.trace.length - 1) {
      const replay = flight.replay;
      flight = null;
      ui();
      $("#score").classList.remove("score-pop");
      void $("#score").offsetWidth;
      $("#score").classList.add("score-pop");
      feedback(
        g.won
          ? `Garden cleared! ${g.shots} spare flights · +${g.shots * 250} bonus`
          : g.lost
            ? "No flights left — try a new angle."
            : g.hits.length
              ? "Nice hit! Line up your next flight."
              : "A little further? Adjust your angle and power.",
      );
      if (g.won) {
        sound("win");
        if (!gentle())
          for (let i = 0; i < 7; i++)
            burst(280 + i * 100, 120 + Math.random() * 100);
      }
      if (replay) feedback("Replay finished · no flights spent");
    }
  }
  for (const [targetIndex, target] of targets.entries()) {
    if (target.hp <= 0) continue;
    const x = target.x / 1000,
      y = target.y / 1000,
      w = target.w / 1000,
      h = target.h / 1000;
    if (targetIndex === hovered && !flight) {
      ctx.strokeStyle = "#fff5b7";
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
    }
    if (target.kind === "sprite") {
      sprite(
        1,
        0,
        x - 9,
        y - 7,
        w + 18,
        h + 11,
        gentle() || flight ? 0 : Math.sin(now * 0.002 + targetIndex) * 0.045,
      );
    } else if (w > h) {
      sprite(
        2,
        0,
        x + w / 2 - (h + 16) / 2,
        y + h / 2 - (w + 8) / 2,
        h + 16,
        w + 8,
        Math.PI / 2,
      );
    } else {
      sprite(target.kind === "stone" ? 3 : 2, 0, x - 8, y - 4, w + 16, h + 8);
      if (target.kind === "stone" && target.hp === 1) {
        ctx.strokeStyle = "#344951";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.6, y);
        ctx.lineTo(x + w * 0.3, y + h * 0.4);
        ctx.lineTo(x + w * 0.7, y + h * 0.6);
        ctx.lineTo(x + w * 0.35, y + h);
        ctx.stroke();
      }
    }
  }
  // Warm ground shadows, sling frame, and a subtle elastic attachment.
  ctx.fillStyle = "#38644533";
  ctx.beginPath();
  ctx.ellipse(182, 479, 40, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  sprite(0, 1, 133, 337, 95, 151);
  let px = 180,
    py = 360;
  if (drag) {
    px += drag.dx;
    py += drag.dy;
  } else if (step >= 0) {
    [px, py] = g.trace[step].map((v) => v / 1000);
  }
  if (drag || step < 0) {
    ctx.lineCap = "round";
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#624426";
    ctx.beginPath();
    ctx.moveTo(162, 369);
    ctx.lineTo(px, py);
    ctx.lineTo(200, 365);
    ctx.stroke();
  }
  aim = drag || aimFromControls();
  if ($("#aim-guide").checked && !flight && step < 0 && !g.won && !g.lost) {
    let x = 180000,
      y = 360000,
      vx = -aim.dx * 135,
      vy = -aim.dy * 135;
    for (let i = 0; i < 130; i++) {
      vy += 110;
      x += Math.trunc(vx / 2);
      y += Math.trunc(vy / 2);
      if (y > 460000) break;
      if (i % 9 === 0) {
        ctx.fillStyle = `rgba(255,255,235,${0.8 - i / 170})`;
        ctx.beginPath();
        ctx.arc(x / 1000, y / 1000, 3.5, 0, 7);
        ctx.fill();
      }
    }
  }
  if (step >= 0 && !gentle()) {
    ctx.lineCap = "round";
    for (let i = Math.max(1, step - 22); i <= step; i++) {
      ctx.strokeStyle = `rgba(255,244,180,${(i - step + 22) / 35})`;
      ctx.lineWidth = 2 + (i - step + 22) * 0.22;
      ctx.beginPath();
      ctx.moveTo(g.trace[i - 1][0] / 1000, g.trace[i - 1][1] / 1000);
      ctx.lineTo(g.trace[i][0] / 1000, g.trace[i][1] / 1000);
      ctx.stroke();
    }
  }
  if (drag) {
    const power = Math.min(1, Math.hypot(drag.dx, drag.dy) / 119);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff70";
    ctx.beginPath();
    ctx.arc(px, py, 38, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
    ctx.strokeStyle = power > 0.85 ? "#ffd279" : "#eaffdf";
    ctx.beginPath();
    ctx.arc(px, py, 38, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * power);
    ctx.stroke();
  }
  const visiblePower = step >= 0 ? g.last_power : selectedPower;
  if (visiblePower !== "normal" && (step >= 0 || !g.won && !g.lost)) {
    ctx.strokeStyle = visiblePower === "burst" ? "#ffc15c" : "#b5eeff";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(px,py,32,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.font = "bold 20px Georgia"; ctx.textAlign = "center";
    ctx.fillText(visiblePower === "burst" ? "✹" : "✦",px,py-40);
  }
  if (step >= 0 || (!g.won && !g.lost))
    sprite(
      0,
      0,
      px - 28,
      py - 29,
      56,
      56,
      step >= 0 ? Math.min(step * 0.035, 8) : 0,
    );
  for (let i = 0; i < Math.min(g.shots - (step < 0 ? 1 : 0), 3); i++)
    sprite(0, 0, 65 + i * 33, 440, 38, 38);
  for (const p of particles) {
    p.x += p.vx * delta;
    p.y += p.vy * delta;
    p.vy += 0.07 * delta;
    p.life -= delta;
    ctx.globalAlpha = Math.max(0, p.life / 38);
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate((p.rotation || 0) + p.life * 0.08);
    if (p.fragment)
      ctx.fillRect(-(p.size || 3) / 2, -2, p.size || 3, (p.size || 3) * 0.6);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size || 3, 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  particles = particles.filter((p) => p.life > 0);
  for (const e of effects) {
    e.life -= delta;
    ctx.globalAlpha = Math.min(1, Math.max(0, e.life / 22));
    if (e.kind === "ring" || e.kind === "bloom") {
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10 + (45 - e.life) * (e.kind === "bloom" ? 2.1 : 1.25), 0, 7);
      ctx.stroke();
    } else {
      ctx.font = "bold 20px system-ui";
      ctx.textAlign = "center";
      ctx.fillStyle = e.color;
      ctx.strokeStyle = "#355743";
      ctx.lineWidth = 4;
      const y = e.y - (70 - e.life) * 0.6;
      ctx.strokeText(e.text, e.x, y);
      ctx.fillText(e.text, e.x, y);
    }
  }
  effects = effects.filter((e) => e.life > 0);
  ctx.globalAlpha = 1;
  ctx.restore();
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * 1100) / r.width,
    y: ((e.clientY - r.top) * 560) / r.height,
  };
}
function pull(p) {
  let dx = Math.min(-8, Math.max(-120, Math.round(p.x - 180))),
    dy = Math.min(100, Math.max(-20, Math.round(p.y - 360)));
  const length = Math.hypot(dx, dy);
  if (length > 119) {
    dx = Math.trunc((dx * 119) / length);
    dy = Math.trunc((dy * 119) / length);
  }
  return { dx, dy };
}
canvas.onpointerdown = (e) => {
  if (!data || busy || flight || data.game.won || data.game.lost) return;
  const p = point(e);
  canvas.focus({ preventScroll: true });
  if (Math.hypot(p.x - 180, p.y - 360) > 65) {
    const t = data.game.targets.find(
      (t) =>
        t.hp > 0 &&
        p.x >= t.x / 1000 - 8 &&
        p.x <= (t.x + t.w) / 1000 + 8 &&
        p.y >= t.y / 1000 - 8 &&
        p.y <= (t.y + t.h) / 1000 + 8,
    );
    if (t)
      feedback(
        t.kind === "sprite"
          ? "Garden sprite · free it with one hit · +500"
          : `${t.kind === "stone" ? "Stone" : "Wood"} support · ${t.hp} hit${t.hp === 1 ? "" : "s"} remaining · +100`,
      );
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  drag = pull(p);
};
canvas.onpointermove = (e) => {
  const p = point(e);
  if (drag) {
    drag = pull(p);
    feedback(
      `Pull power ${Math.round(Math.hypot(drag.dx, drag.dy) / 1.19)}% · release to fly · Esc to cancel`,
    );
  } else if (data && !flight)
    hovered = data.game.targets.findIndex(
      (t) =>
        t.hp > 0 &&
        p.x >= t.x / 1000 &&
        p.x <= (t.x + t.w) / 1000 &&
        p.y >= t.y / 1000 &&
        p.y <= (t.y + t.h) / 1000,
    );
};
canvas.onpointerup = async (e) => {
  if (!drag) return;
  document.dispatchEvent(new Event("utxoplay:game-start"));
  const a = drag;
  drag = null;
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  await act({ type: "launch", ...a }, true);
};
canvas.onpointercancel = () => {
  drag = null;
  feedback("Pull cancelled. Ready when you are.");
};
canvas.onpointerleave = () => {
  hovered = -1;
};
async function act(action, animate = false) {
  if (!data || busy || flight) return;
  if (action.type === "launch") { action.power = selectedPower; void startSound(); }
  busy = true;
  feedback(action.type === "extra" ? "One more flight…" : "Preparing your flight…");
  ui();
  try {
    data = await api("/games/sling/api/action", {
      action,
      expected_block: data.session.block_hash,
      session_id: data.session.id,
    });
    if (action.type !== "extra") selectedPower = "normal";
    else { sound("move"); feedback("Extra flight ready. Find your arc!"); }
    if (animate) {
      beginFlight();
      sound("launch");
    }
    ui();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    ui();
  }
}
for (const button of document.querySelectorAll("[data-power]")) {
  button.onclick = () => { selectedPower = button.dataset.power; ui(); sound("move"); };
}
$("#extra-flight").onclick = $("#rescue-flight").onclick = () => act({type:"extra"});
$("#launch").onclick = () =>
  act({ type: "launch", ...aimFromControls() }, true);
for (const name of ["angle", "power"])
  $("#" + name).oninput = (e) => {
    $("#" + name + "-value").textContent =
      e.target.value + (name === "angle" ? "°" : "%");
    feedback(
      `Aim ${$("#angle").value}° · power ${$("#power").value}% · Space to launch`,
    );
  };
async function newGame() {
  if (busy || flight) return;
  busy = true;
  try {
    data = await api("/games/sling/api/new", {});
    selectedPower = "normal";
    $("#verification").textContent = "";
    particles = [];
    effects = [];
    shake = 0;
    feedback("A fresh garden. Find your arc.");
    ui();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    ui();
  }
}
$("#new").onclick = newGame;
$("#continue").onclick = () => {
  if (data.game.won && data.game.level === data.game.total_levels) newGame();
  else act({ type: data.game.won ? "next" : "retry" });
};
$("#verify").onclick = async () => {
  if (busy || flight) return;
  $("#verify").disabled = true;
  try {
    const r = await api("/games/sling/api/replay", {});
    $("#verification").textContent =
      "✓ " + r.frames + " frames replayed. Every state root matches.";
  } catch (e) {
    toast(e.message);
  } finally {
    $("#verify").disabled = false;
  }
};
$("#replay-shot").onclick = () => {
  if (busy || flight) return;
  if (!data || !data.game.trace.length) {
    toast("Take your first flight to replay it.");
    return;
  }
  beginFlight(true);
  ui();
};
function syncAudio() {
  const state = audioState();
  $("#sound").textContent = state.playing ? "♫ Music on" : state.enabled ? "♫ Play music" : "♫ Music off";
  $("#sound").setAttribute("aria-pressed", String(state.enabled));
  $("#volume").value = Math.round(state.volume * 100);
}
document.addEventListener("skyward:audio", syncAudio);
syncAudio();
$("#sound").onclick = async () => { await toggleSound(); syncAudio(); };
// Unlock audio on a real interaction, including touch/keyboard; respect a saved mute.
for (const name of ["pointerdown", "keydown"]) document.addEventListener(name, (event) => {
  if (event.target.closest?.("#sound") || audioState().playing) return;
  void startSound();
}, {capture:true});
$("#volume").oninput = (e) => volume(+e.target.value / 100);
$("#credits-open").onclick = () => $("#credits").showModal();
$("#credits-close").onclick = () => $("#credits").close();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drag) {
    drag = null;
    feedback("Pull cancelled.");
  }
});
document.addEventListener("utxoplay:menu", (e) => {
  if (e.detail.open && drag) {drag = null;feedback("Pull cancelled.");}
});
canvas.onkeydown = (e) => {
  if (busy || flight) return;
  if (e.code === "Space") {
    e.preventDefault();
    $("#launch").click();
  }
  const key = {
    ArrowLeft: ["angle", -1],
    ArrowRight: ["angle", 1],
    ArrowUp: ["power", 1],
    ArrowDown: ["power", -1],
  }[e.key];
  if (key) {
    e.preventDefault();
    const input = $("#" + key[0]);
    input.value = Math.max(
      +input.min,
      Math.min(+input.max, +input.value + key[1] * (e.shiftKey ? 5 : 1)),
    );
    input.dispatchEvent(new Event("input"));
  }
};
try {
  data = await api("/games/sling/api/state");
  ui();
} catch (e) {
  toast(e.message);
}
startRenderLoop(render, {
  active: () =>
    !!flight || !!drag || particles.length > 0 || effects.length > 0,
  maxFps: 60,
});
startPolling(
  async () => {
    const before = data;
    if (busy || flight || drag || document.hidden) return;
    try {
      const d = await api("/games/sling/api/state");
      if (busy || flight || drag || data !== before || document.hidden) return;
      if (
        d.session.block_hash !== data?.session.block_hash ||
        d.session.id !== data?.session.id
      ) {
        data = d;
        ui();
      }
    } catch {}
  },
  { interval: 5000 },
);
