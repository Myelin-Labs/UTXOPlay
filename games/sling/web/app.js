import { toggleSound, volume, sound } from "./audio.js";
const $ = (s) => document.querySelector(s),
  canvas = $("#world"),
  ctx = canvas.getContext("2d");
let data,
  busy = false,
  drag = null,
  flight = null,
  particles = [],
  toastTimer,
  lastFrame = 0,
  frameHandle;
const bg = new Image();
bg.src = "/games/sling/assets/islands.png";
const sprites = new Image();
sprites.src = "/games/sling/assets/characters.png";
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
  const g = data.game;
  $("#level").textContent = String(g.level).padStart(2, "0");
  $("#level-name").textContent = [
    "First flight",
    "Stone & sky",
    "The high garden",
  ][g.level - 1];
  $("#score").textContent = String(g.score).padStart(4, "0");
  $("#shots").textContent = "● ".repeat(g.shots) + "○ ".repeat(4 - g.shots);
  $("#level-result").hidden = !!flight || (!g.won && !g.lost);
  $("#launch").disabled = busy || !!flight || g.won || g.lost;
  $("#new").disabled = busy || !!flight;
  $("#continue").textContent = g.won
    ? g.level === 3
      ? "A new adventure ↗"
      : "Next island →"
    : "Try this island again ↻";
  $("#result-kicker").textContent = g.won
    ? "BEAUTIFULLY FLOWN"
    : "ONE MORE LITTLE TRY";
  $("#result-title").textContent = g.won
    ? g.level === 3
      ? "A sky full of stories."
      : "Garden cleared!"
    : "Find a different arc.";
  $("#result-copy").textContent = g.won
    ? g.level === 3
      ? "All three gardens are home again. Your adventure is ready to save."
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
function render(now) {
  frameHandle = requestAnimationFrame(render);
  if (document.hidden || now - lastFrame < 14) return;
  const delta = Math.min(2, (now - lastFrame) / 16.667 || 1);
  lastFrame = now;
  ctx.clearRect(0, 0, 1100, 560);
  if (bg.complete && bg.naturalWidth) ctx.drawImage(bg, 0, 0, 1100, 560);
  else {
    ctx.fillStyle = "#c5e5d9";
    ctx.fillRect(0, 0, 1100, 560);
  }
  if (!data) return;
  const g = data.game;
  let targets = g.targets,
    step = -1;
  if (flight) {
    step = Math.min(
      g.trace.length - 1,
      Math.floor((now - flight.start) / 8.333),
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
          burst(
            (target.x + target.w / 2) / 1000,
            (target.y + target.h / 2) / 1000,
          );
          sound("hit");
        }
      }
    }
    if (step === g.trace.length - 1) {
      flight = null;
      ui();
      if (g.won) sound("win");
    }
  }
  for (const target of targets) {
    if (target.hp <= 0) continue;
    const x = target.x / 1000,
      y = target.y / 1000,
      w = target.w / 1000,
      h = target.h / 1000;
    if (target.kind === "sprite") {
      sprite(1, 0, x - 9, y - 7, w + 18, h + 11);
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
  if (drag) {
    let x = 180000,
      y = 360000,
      vx = -drag.dx * 135,
      vy = -drag.dy * 135;
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
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  particles = particles.filter((p) => p.life > 0);
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
  if (Math.hypot(p.x - 180, p.y - 360) > 65) return;
  canvas.setPointerCapture(e.pointerId);
  drag = pull(p);
};
canvas.onpointermove = (e) => {
  if (drag) drag = pull(point(e));
};
canvas.onpointerup = async (e) => {
  if (!drag) return;
  const a = drag;
  drag = null;
  if (canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  await act({ type: "launch", ...a }, true);
};
canvas.onpointercancel = () => (drag = null);
async function act(action, animate = false) {
  if (busy || flight) return;
  busy = true;
  ui();
  try {
    data = await api("/games/sling/api/action", {
      action,
      expected_block: data.session.block_hash,
      session_id: data.session.id,
    });
    if (animate) {
      flight = { start: performance.now(), fired: new Set() };
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
$("#launch").onclick = () => {
  const angle = (+$("#angle").value * Math.PI) / 180,
    power = +$("#power").value * 1.18;
  act(
    {
      type: "launch",
      dx: -Math.max(8, Math.round(Math.cos(angle) * power)),
      dy: Math.round(Math.sin(angle) * power),
    },
    true,
  );
};
for (const name of ["angle", "power"])
  $("#" + name).oninput = (e) =>
    ($("#" + name + "-value").textContent =
      e.target.value + (name === "angle" ? "°" : "%"));
async function newGame() {
  if (busy || flight) return;
  busy = true;
  try {
    data = await api("/games/sling/api/new", {});
    $("#verification").textContent = "";
    particles = [];
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
  if (data.game.won && data.game.level === 3) newGame();
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
  if (!data.game.trace.length) {
    toast("Take your first flight to replay it.");
    return;
  }
  flight = { start: performance.now(), fired: new Set() };
  ui();
};
$("#sound").onclick = async () => {
  const on = await toggleSound();
  $("#sound").textContent = on ? "♫ Sound on" : "♫ Sound off";
  $("#sound").setAttribute("aria-pressed", on);
};
$("#volume").oninput = (e) => volume(+e.target.value / 100);
$("#credits-open").onclick = () => $("#credits").showModal();
$("#credits-close").onclick = () => $("#credits").close();
canvas.onkeydown = (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    $("#launch").click();
  }
};
try {
  data = await api("/games/sling/api/state");
  ui();
} catch (e) {
  toast(e.message);
}
frameHandle = requestAnimationFrame(render);
setInterval(async () => {
  if (busy || flight || drag || document.hidden) return;
  try {
    const d = await api("/games/sling/api/state");
    if (
      d.session.block_hash !== data?.session.block_hash ||
      d.session.id !== data?.session.id
    ) {
      data = d;
      ui();
    }
  } catch {}
}, 2500);
