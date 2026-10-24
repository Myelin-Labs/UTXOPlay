import { startPolling } from "./performance.mjs";
import { toggleSound, volume, sound } from "./audio.js";
globalThis.UTXOPlayLoader?.boot();
globalThis.UTXOPlayLoader?.images(['/games/chess/assets/study.webp','/games/chess/assets/pieces.webp']);
const $ = (s) => document.querySelector(s);
let data,
  selected = null,
  flipped = false,
  busy = false,
  replaying = false,
  timer;
let reviewIndex = null,
  positions = null,
  replayToken = 0;
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
  const boardElement = $("#board");
  const index = reviewIndex ?? data.game.moves.length;
  const last = data.game.moves[index - 1] || "";
  const legal = data.game.legal_moves.filter(
    (m) => reviewIndex === null && m.startsWith(selected || "!"),
  );
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const file = flipped ? 7 - x : x,
        rank = flipped ? y + 1 : 8 - y,
        sq = "abcdefgh"[file] + rank,
        p = pieces[sq];
      const b =
        boardElement.children[y * 8 + x] || document.createElement("button");
      b.className =
        "square" +
        ((file + rank) % 2 === 1 ? " dark" : "") +
        (selected === sq ? " selected" : "") +
        ([last.slice(0, 2), last.slice(2, 4)].includes(sq) ? " last" : "");
      b.setAttribute("role", "gridcell");
      if (
        reviewIndex === null &&
        data.game.in_check &&
        p === (data.game.turn === "white" ? "K" : "k")
      )
        b.classList.add("in-check");
      b.setAttribute("aria-selected", String(selected === sq));
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
      b.dataset.piece = p || "";
      const contentKey = [p, x === 0 ? rank : "", y === 7 ? file : ""].join(
        ":",
      );
      if (b.dataset.content !== contentKey) {
        b.dataset.content = contentKey;
        b.replaceChildren();
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
      }
      if (!b.isConnected) boardElement.append(b);
    }
}
$("#board").addEventListener("click", (event) => {
  const cell = event.target.closest("[data-square]");
  if (cell) select(cell.dataset.square, cell.dataset.piece || undefined);
});
async function select(sq, p) {
  if (!data || busy || replaying || reviewIndex !== null || data.game.result)
    return;
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
  $("#hint").textContent = selected
    ? `${pieceNames[p.toLowerCase()]} on ${sq}: choose a highlighted square.`
    : "Select a piece to see legal moves.";
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
  $("#connection").hidden = true;
  $("#resign").disabled = false;
  if ($("#auto-flip").checked) flipped = data.game.turn === "black";
  showBoard();
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
  updateMaterial();
  $("#move-count").textContent =
    g.moves.length + (g.moves.length === 1 ? " ply" : " plies");
  if (g.moves.length) {
    $("#moves").replaceChildren();
    for (let i = 0; i < g.moves.length; i += 2) {
      const row = document.createElement("div");
      row.className = "move-row";
      const number = document.createElement("span");
      number.textContent = i / 2 + 1 + ".";
      row.append(number);
      for (let j = i; j < i + 2; j++) {
        const b = document.createElement("button");
        b.textContent = g.moves[j]
          ? g.moves[j].slice(0, 2) + " → " + g.moves[j].slice(2)
          : "—";
        b.disabled = !g.moves[j];
        b.dataset.ply = j + 1;
        b.onclick = () => review(j + 1);
        row.append(b);
      }
      $("#moves").append(row);
    }
    $("#moves").scrollTop = $("#moves").scrollHeight;
  } else
    $("#moves").innerHTML =
      '<p class="empty">Every great game starts<br>with a small move.</p>';
  reviewControls();
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
  if (!data || busy || replaying || reviewIndex !== null) return;
  busy = true;
  $("#board").setAttribute("aria-busy", "true");
  try {
    data = await api("/games/chess/api/action", {
      action,
      expected_block: data.session.block_hash,
      session_id: data.session.id,
    });
    positions = null;
    sound(data.game.result ? "win" : "move");
    render();
  } catch (e) {
    toast(e.message);
    try {
      data = await api("/games/chess/api/state");
      positions = null;
      render();
    } catch {
      $("#connection").hidden = false;
    }
  } finally {
    busy = false;
    if (data) reviewControls();
    $("#board").setAttribute("aria-busy", "false");
  }
}
$("#new").onclick = async () => {
  if (busy || replaying) return;
  if (
    data?.game.moves.length &&
    !data.game.result &&
    !(await confirmAction(
      "Start a new match?",
      "Your current match will be replaced. Save its export first if you want to keep it.",
    ))
  )
    return;
  busy = true;
  try {
    data = await api("/games/chess/api/new", {});
    positions = null;
    reviewIndex = null;
    selected = null;
    $("#verification").textContent = "";
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    if (data) reviewControls();
  }
};
$("#flip").onclick = () => {
  flipped = !flipped;
  $("#auto-flip").checked = false;
  showBoard();
};
$("#resign").onclick = async () => {
  if (
    data &&
    (await confirmAction(
      "Resign this match?",
      "Your opponent will win the match.",
    ))
  )
    act({ type: "resign" });
};
$("#draw").onclick = () => act({ type: "claim_draw" });
$("#replay").onclick = async () => {
  if (!data || busy) return;
  if (replaying) {
    replayToken++;
    replaying = false;
    reviewIndex = null;
    render();
    $("#replay").textContent = "▷ Replay & verify";
    return;
  }
  replaying = true;
  const token = ++replayToken;
  $("#replay").textContent = "Stop replay";
  try {
    await loadPositions();
    for (let i = 0; i < positions.length && token === replayToken; i++) {
      reviewIndex = i;
      selected = null;
      showBoard();
      await new Promise((r) => setTimeout(r, 650));
    }
  } catch (e) {
    toast(e.message);
  } finally {
    if (token === replayToken) {
      replaying = false;
      reviewIndex = null;
      render();
      $("#replay").textContent = "▷ Replay & verify";
    }
  }
};
function confirmAction(title, copy) {
  return new Promise((resolve) => {
    const d = $("#confirm-action");
    $("#confirm-title").textContent = title;
    $("#confirm-copy").textContent = copy;
    const done = (v) => {
      d.close();
      resolve(v);
    };
    $("#confirm-yes").onclick = () => done(true);
    $("#confirm-cancel").onclick = () => done(false);
    d.oncancel = () => resolve(false);
    d.showModal();
  });
}
function reviewControls() {
  const i = reviewIndex ?? data.game.moves.length;
  $("#review-label").textContent =
    reviewIndex === null
      ? "Live board"
      : `Review ${i} / ${data.game.moves.length}`;
  $("#review-first").disabled = $("#review-prev").disabled =
    !i || busy || replaying;
  $("#review-next").disabled = reviewIndex === null || busy || replaying;
  $("#review-live").disabled = reviewIndex === null || replaying;
  $("#resign").disabled =
    !!data.game.result || reviewIndex !== null || replaying;
  $("#draw").disabled = reviewIndex !== null || replaying;
  document.body.classList.toggle("reviewing", reviewIndex !== null);
  document
    .querySelectorAll("[data-ply]")
    .forEach((b) => b.classList.toggle("current", Number(b.dataset.ply) === i));
}
function showBoard() {
  if (!data) return;
  const fen =
    reviewIndex === null
      ? data.game.fen
      : positions?.[reviewIndex] || data.game.fen;
  board(fen);
  reviewControls();
  updateMaterial();
  $(".table").classList.toggle("flipped", flipped);
  const side = data.game.turn === "white" ? "White" : "Black";
  $("#status").textContent =
    reviewIndex === null
      ? data.game.result
        ? data.game.result.replace(/([a-z])([A-Z])/g, "$1 $2")
        : side + " to move" + (data.game.in_check ? " · check" : "")
      : `Review · ply ${reviewIndex}`;
  $("#hint").textContent =
    reviewIndex === null
      ? "Select a piece to see its legal moves."
      : "Viewing a saved position. Return to Live to continue playing.";
}
async function loadPositions() {
  if (positions) return;
  const r = await api("/games/chess/api/replay", {});
  positions = r.positions;
  $("#verification").textContent =
    `✓ ${r.frames} signed frames replayed. State matches.`;
}
async function review(i) {
  if (!data || busy || replaying) return;
  busy = true;
  try {
    await loadPositions();
    reviewIndex = Math.max(0, Math.min(i, positions.length - 1));
    selected = null;
    showBoard();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    reviewControls();
  }
}
$("#review-first").onclick = () => review(0);
$("#review-prev").onclick = () =>
  review((reviewIndex ?? data?.game.moves.length) - 1);
$("#review-next").onclick = () => {
  if (reviewIndex + 1 >= positions?.length - 1) {
    reviewIndex = null;
    showBoard();
  } else review(reviewIndex + 1);
};
$("#review-live").onclick = () => {
  reviewIndex = null;
  showBoard();
};
$("#auto-flip").onchange = () => {
  if (data) {
    flipped = data.game.turn === "black";
    showBoard();
  }
};
$("#copy-fen").onclick = async () => {
  if (!data) return;
  try {
    await navigator.clipboard.writeText(
      reviewIndex === null ? data.game.fen : positions[reviewIndex],
    );
    toast("Position copied as FEN.");
  } catch {
    toast("Clipboard unavailable in this browser.");
  }
};
$("#help-open").onclick = () => $("#help").showModal();
$("#help-close").onclick = () => $("#help").close();
function updateMaterial() {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let balance = 0;
  for (const p of (reviewIndex === null
    ? data.game.fen
    : positions[reviewIndex]
  ).split(" ")[0])
    if (values[p.toLowerCase()] !== undefined)
      balance += values[p.toLowerCase()] * (p === p.toUpperCase() ? 1 : -1);
  $("#material").textContent =
    balance === 0
      ? "Material is even"
      : `${balance > 0 ? "White" : "Black"} +${Math.abs(balance)} material`;
  // Reconstruct captures from authoritative UCI moves, including en passant and promotions.
  const map = {};
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR".split("/").forEach((row, y) => {
    let x = 0;
    for (const p of row) {
      if (/[1-8]/.test(p)) x += +p;
      else map["abcdefgh"[x++] + (8 - y)] = p;
    }
  });
  const taken = { white: [], black: [] },
    glyphs = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
  for (const m of data.game.moves.slice(
    0,
    reviewIndex ?? data.game.moves.length,
  )) {
    const from = m.slice(0, 2),
      to = m.slice(2, 4),
      p = map[from];
    if (!p) continue;
    const side = p === p.toUpperCase() ? "white" : "black";
    let captured = map[to];
    if (p.toLowerCase() === "p" && from[0] !== to[0] && !captured) {
      const sq = to[0] + from[1];
      captured = map[sq];
      delete map[sq];
    }
    if (captured) taken[side].push(glyphs[captured.toLowerCase()]);
    delete map[from];
    map[to] = m[4] ? (side === "white" ? m[4].toUpperCase() : m[4]) : p;
    if (
      p.toLowerCase() === "k" &&
      Math.abs(to.charCodeAt(0) - from.charCodeAt(0)) === 2
    ) {
      const rook = (to[0] === "g" ? "h" : "a") + from[1],
        dest = (to[0] === "g" ? "f" : "d") + from[1];
      map[dest] = map[rook];
      delete map[rook];
    }
  }
  for (const side of ["white", "black"])
    $("#" + side + "-captures").textContent = taken[side].join(" ") || "—";
}
document.addEventListener("keydown", (e) => {
  if (
    e.target.matches("input,textarea") ||
    document.querySelector("dialog[open]")
  )
    return;
  if (e.key === "f" || e.key === "F") $("#flip").click();
  if (e.key === "Escape") {
    selected = null;
    showBoard();
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    $("#review-prev").click();
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    $("#review-next").click();
  }
});
$("#sound").onclick = async () => {
  const on = await toggleSound();
  $("#sound").textContent = on ? "♫ Sound on" : "♫ Sound off";
  $("#sound").setAttribute("aria-pressed", on);
};
$("#volume").oninput = (e) => volume(+e.target.value / 100);
$("#credits-open").onclick = () => $("#credits").showModal();
$("#credits-close").onclick = () => $("#credits").close();
async function refresh() {
  $("#retry").disabled = true;
  try {
    data = await api("/games/chess/api/state");
    globalThis.UTXOPlayLoader?.session();
    positions = null;
    reviewIndex = null;
    render();
    globalThis.UTXOPlayLoader?.ready();
  } catch (e) {
    globalThis.UTXOPlayLoader?.fail("session");
    toast(e.message);
    $("#status").textContent = "Table unavailable";
    $("#connection").hidden = false;
    $("#resign").disabled = true;
  } finally {
    $("#retry").disabled = false;
  }
}
$("#retry").onclick = refresh;
await refresh();
startPolling(
  async () => {
    const before = data;
    if (
      busy ||
      replaying ||
      reviewIndex !== null ||
      selected ||
      document.hidden
    )
      return;
    try {
      const next = await api("/games/chess/api/state");
      if (
        busy ||
        replaying ||
        reviewIndex !== null ||
        selected ||
        data !== before ||
        document.hidden
      )
        return;
      if (
        next.session.block_hash !== data?.session.block_hash ||
        next.session.id !== data?.session.id
      ) {
        data = next;
        positions = null;
        render();
      }
    } catch {}
  },
  { interval: 5000 },
);
