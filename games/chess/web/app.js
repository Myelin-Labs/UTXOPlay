import { toggleSound, volume, sound } from "./audio.js";
const $ = (s) => document.querySelector(s);
let data,
  selected = null,
  flipped = false,
  busy = false,
  replaying = false,
  timer;
const pieceNames = {
    k: "king",
    q: "queen",
    b: "bishop",
    n: "knight",
    r: "rook",
    p: "pawn",
  },
  sprite = { k: 0, q: 1, b: 2, n: 3, r: 4, p: 5 };
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
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
function board(fen = data.game.fen) {
  const pieces = {};
  fen
    .split(" ")[0]
    .split("/")
    .forEach((row, y) => {
      let x = 0;
      for (const p of row) {
        if (/[1-8]/.test(p)) x += +p;
        else {
          pieces["abcdefgh"[x] + (8 - y)] = p;
          x++;
        }
      }
    });
  $("#board").replaceChildren();
  const last = data.game.moves.at(-1) || "";
  const legal = data.game.legal_moves.filter((m) =>
    m.startsWith(selected || "!"),
  );
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const file = flipped ? 7 - x : x,
        rank = flipped ? y + 1 : 8 - y,
        sq = "abcdefgh"[file] + rank,
        p = pieces[sq];
      const b = document.createElement("button");
      b.className =
        "square" +
        ((file + rank) % 2 === 1 ? " dark" : "") +
        (selected === sq ? " selected" : "") +
        ([last.slice(0, 2), last.slice(2, 4)].includes(sq) ? " last" : "");
      b.setAttribute("role", "gridcell");
      b.dataset.square = sq;
      b.setAttribute(
        "aria-label",
        sq +
          (p
            ? " " +
              (p === p.toUpperCase() ? "white " : "black ") +
              pieceNames[p.toLowerCase()]
            : " empty"),
      );
      if (legal.some((m) => m.slice(2, 4) === sq))
        b.classList.add("legal", p ? "capture" : "legal");
      if (p) {
        const span = document.createElement("span");
        span.className = "piece";
        span.style.setProperty("--col", sprite[p.toLowerCase()]);
        span.style.setProperty("--row", p === p.toUpperCase() ? 0 : 1);
        b.append(span);
      }
      if (x === 0) {
        const span = document.createElement("span");
        span.className = "coord";
        span.textContent = rank;
        b.append(span);
      }
      if (y === 7) {
        const span = document.createElement("span");
        span.className = "coord file";
        span.textContent = "abcdefgh"[file];
        b.append(span);
      }
      b.addEventListener("click", () => select(sq, p));
      $("#board").append(b);
    }
}
async function select(sq, p) {
  if (busy || replaying || data.game.result) return;
  if (selected) {
    const choices = data.game.legal_moves.filter(
      (m) => m.slice(0, 4) === selected + sq,
    );
    if (choices.length) {
      let uci = choices[0];
      if (choices.length > 1) {
        uci = await promotion(choices);
        if (!uci) return;
      }
      selected = null;
      await act({ type: "move", uci });
      return;
    }
  }
  const ours = p && (p === p.toUpperCase()) === (data.game.turn === "white");
  selected = ours ? (selected === sq ? null : sq) : null;
  board();
}
function promotion(choices) {
  return new Promise((resolve) => {
    const dialog = $("#promotion");
    $("#promotion-choices").replaceChildren();
    const done = (v) => {
      dialog.close();
      resolve(v);
    };
    for (const m of choices) {
      const b = document.createElement("button");
      b.textContent = { q: "♕", r: "♖", b: "♗", n: "♘" }[m[4]];
      b.setAttribute("aria-label", "Promote to " + pieceNames[m[4]]);
      b.onclick = () => done(m);
      $("#promotion-choices").append(b);
    }
    $("#promotion-cancel").onclick = () => done(null);
    dialog.oncancel = () => resolve(null);
    dialog.showModal();
  });
}
function render() {
  board();
  const g = data.game;
  const side = g.turn === "white" ? "White" : "Black";
  $("#status").textContent = g.result
    ? g.result.replace(/([a-z])([A-Z])/g, "$1 $2")
    : side + " to move" + (g.in_check ? " · check" : "");
  $("#hint").textContent = g.result
    ? "A game to remember. Save the match, or begin again."
    : g.in_check
      ? "Your king is in check. Find a safe way forward."
      : "Select a piece, then its destination. Pass the turn to your opponent.";
  $("#white-state").textContent =
    g.turn === "white" && !g.result
      ? "Considering the next move"
      : "Waiting for the reply";
  $("#black-state").textContent =
    g.turn === "black" && !g.result
      ? "Considering the next move"
      : "Waiting for the reply";
  $("#draw").hidden = !g.can_claim_draw || !!g.result;
  $("#resign").disabled = !!g.result;
  $("#move-count").textContent = g.moves.length + " plies";
  if (g.moves.length) {
    $("#moves").replaceChildren();
    for (let i = 0; i < g.moves.length; i += 2) {
      const row = document.createElement("div");
      row.className = "move-row";
      for (const t of [i / 2 + 1 + ".", g.moves[i], g.moves[i + 1] || "—"]) {
        const span = document.createElement("span");
        span.textContent = t;
        row.append(span);
      }
      $("#moves").append(row);
    }
    $("#moves").scrollTop = $("#moves").scrollHeight;
  } else
    $("#moves").innerHTML =
      '<p class="empty">Every great game starts<br>with a small move.</p>';
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
async function act(action) {
  if (busy || replaying) return;
  busy = true;
  try {
    data = await api("/games/chess/api/action", {
      action,
      expected_block: data.session.block_hash,
      session_id: data.session.id,
    });
    sound(data.game.result ? "win" : "move");
    render();
  } catch (e) {
    toast(e.message);
    data = await api("/games/chess/api/state");
    render();
  } finally {
    busy = false;
  }
}
$("#new").onclick = async () => {
  if (busy || replaying) return;
  busy = true;
  try {
    data = await api("/games/chess/api/new", {});
    selected = null;
    $("#verification").textContent = "";
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
  }
};
$("#flip").onclick = () => {
  flipped = !flipped;
  board();
};
$("#resign").onclick = () => act({ type: "resign" });
$("#draw").onclick = () => act({ type: "claim_draw" });
$("#replay").onclick = async () => {
  if (busy || replaying) return;
  replaying = true;
  $("#replay").disabled = true;
  try {
    const r = await api("/games/chess/api/replay", {});
    $("#verification").textContent =
      "✓ " + r.frames + " signed frames replayed. State matches.";
    if (r.positions)
      for (const fen of r.positions) {
        board(fen);
        await new Promise((r) => setTimeout(r, 550));
      }
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    replaying = false;
    $("#replay").disabled = false;
  }
};
$("#sound").onclick = async () => {
  const on = await toggleSound();
  $("#sound").textContent = on ? "♫ Sound on" : "♫ Sound off";
  $("#sound").setAttribute("aria-pressed", on);
};
$("#volume").oninput = (e) => volume(+e.target.value / 100);
$("#credits-open").onclick = () => $("#credits").showModal();
$("#credits-close").onclick = () => $("#credits").close();
try {
  data = await api("/games/chess/api/state");
  render();
} catch (e) {
  toast(e.message);
  $("#status").textContent = "Table unavailable";
}
setInterval(async () => {
  if (busy || replaying || selected || document.hidden) return;
  try {
    const next = await api("/games/chess/api/state");
    if (
      next.session.block_hash !== data?.session.block_hash ||
      next.session.id !== data?.session.id
    ) {
      data = next;
      render();
    }
  } catch {}
}, 2500);
