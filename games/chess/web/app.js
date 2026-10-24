import { ChessEngine } from "./engine-client.mjs";
import { notation, squareAt, preferences } from "./strategy.js";
import { startPolling } from "./performance.mjs";
import { toggleSound, volume, sound, savedVolume } from "./audio.js";
globalThis.UTXOPlayLoader?.boot();
globalThis.UTXOPlayLoader?.images([
  "/games/chess/assets/blue-hour.webp",
  "/games/chess/assets/porcelain-pieces.webp",
]);
const $ = (s) => document.querySelector(s);
const engine = new ChessEngine();
let roomId = new URLSearchParams(location.hash.slice(1)).get("table"), roomStream=null, roomConnected=false;
if (!/^[a-f0-9]{24}$/.test(roomId||"")) roomId=null;
const endpoint = name => roomId ? `/games/chess/api/rooms/${roomId}/${name}` : `/games/chess/api/${name}`;
const roomTurn = () => !roomId || !!(roomConnected && data?.room?.ready && data.room.color === data.game.turn);

let data,
  selected = null,
  flipped = false,
  busy = false,
  replaying = false,
  timer;
let pref;
try {
  pref = preferences(
    JSON.parse(localStorage.getItem("chess:preferences") || "{}"),
  );
} catch {
  pref = preferences();
}
let worker = null,
  botTimer,
  botTimeout,
  botEpoch = 0,
  botFailed = false,
  menuOpen = false,
  choosing = false,
  notationKey = "",
  record = { san: [], pgn: "" };
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
      ? { signal: AbortSignal.timeout(12000) }
      : {
          signal: AbortSignal.timeout(12000),
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
      b.tabIndex = (selected ? sq === selected : sq === (flipped ? "d5" : "e4"))
        ? 0
        : -1;
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
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (cell) select(cell.dataset.square, cell.dataset.piece || undefined);
});
async function select(sq, p) {
  if (
    !data ||
    busy ||
    choosing ||
    botTurn() ||
    !roomTurn() ||
    replaying ||
    reviewIndex !== null ||
    data.game.result
  )
    return;
  if (selected) {
    const choices = data.game.legal_moves.filter(
      (m) => m.slice(0, 4) === selected + sq,
    );
    if (choices.length) {
      let uci = choices[0];
      if (choices.length > 1) {
        choosing = true;
        uci = await promotion(choices);
        choosing = false;
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
      const piece = document.createElement("span");
      piece.className = "piece";
      piece.style.setProperty("--col", sprite[m[4]]);
      piece.style.setProperty("--row", data.game.turn === "white" ? 0 : 1);
      const label = document.createElement("span");
      label.textContent = pieceNames[m[4]];
      b.append(piece, label);
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
  if (!roomId && $("#auto-flip").checked) flipped = data.game.turn === "black";
  showBoard();
  const g = data.game;
  const key = g.moves.join(" ");
  if (key !== notationKey) {
    try {
      record = notation(g.moves);
    } catch {
      record = { san: g.moves, pgn: "" };
    }
    notationKey = key;
  }
  for (const color of ["white", "black"])
    $("." + color + "-player").classList.toggle(
      "active",
      g.turn === color && !g.result,
    );
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
  if (g.moves.length && $("#moves").dataset.key !== key) {
    $("#moves").dataset.key = key;
    $("#moves").replaceChildren();
    for (let i = 0; i < g.moves.length; i += 2) {
      const row = document.createElement("div");
      row.className = "move-row";
      const number = document.createElement("span");
      number.textContent = i / 2 + 1 + ".";
      row.append(number);
      for (let j = i; j < i + 2; j++) {
        const b = document.createElement("button");
        b.textContent = g.moves[j] ? record.san[j] || g.moves[j] : "—";
        b.disabled = !g.moves[j];
        b.dataset.ply = j + 1;
        b.onclick = () => review(j + 1);
        row.append(b);
      }
      $("#moves").append(row);
    }
    $("#moves").scrollTop = $("#moves").scrollHeight;
  } else if (!g.moves.length)
    $("#moves").innerHTML =
      '<p class="empty">Every great game starts<br>with a small move.</p>';
  reviewControls();
  updateTable();
  scheduleBot();
  $("#session-short").textContent = data.session.id.slice(0, 12) + "…";
  if ($("#session-info").dataset.head === data.session.block_hash) return;
  $("#session-info").dataset.head = data.session.block_hash;
  $("#session-info").replaceChildren();
  for (const [k, v] of Object.entries(data.session)) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = String(v);
    $("#session-info").append(dt, dd);
  }
}
async function act(action, computer = false) {
  if (
    !data ||
    busy ||
    replaying ||
    reviewIndex !== null ||
    !roomTurn() ||
    (!computer && botTurn())
  )
    return;
  cancelBot();
  const beforeFen = data.game.fen;
  busy = true;
  $("#board").setAttribute("aria-busy", "true");
  try {
    data = await api(endpoint("action"), {
      action,
      expected_block: data.session.block_hash,
      session_id: data.session.id,
    });
    positions = null;
    const captured =
      action.uci &&
      new Map(Object.entries(readBoard(beforeFen))).get(action.uci.slice(2, 4));
    sound(data.game.result ? "win" : captured ? "hit" : "move");
    render();
    animateMove(action.uci);
  } catch (e) {
    toast(e.message);
    try {
      data = await api(endpoint("state"));
      positions = null;
      render();
    } catch {
      $("#connection").hidden = false;
    }
    if (computer && botTurn())
      botError(
        "The move could not be saved. Resume the computer when the connection is ready.",
      );
  } finally {
    busy = false;
    if (data) reviewControls();
    $("#board").setAttribute("aria-busy", "false");
    scheduleBot();
  }
}
$("#new").onclick = async () => {
  if (busy || replaying || choosing) return;
  if ($("#opponent").value === "online") { await createRoom(); return; }
  cancelBot();
  if (
    data?.game.moves.length &&
    !data.game.result &&
    !(await confirmAction(
      "Start a new match?",
      roomId ? "Your online table stays saved in Your recent tables. Start a separate practice game?" : "Your current match will be replaced. Save its export first if you want to keep it.",
    ))
  )
    return;
  busy = true;
  try {
    data = await api("/games/chess/api/new", {});
    disconnectRoom();
    roomId=null;history.replaceState(null,"",location.pathname);
    pref = {
      ...pref,
      opponent: $("#opponent").value,
      color: $("#human-color").value,
    };
    savePreferences();
    botFailed = false;
    $("#bot-retry").hidden = true;
    flipped = pref.opponent !== "local" && pref.color === "black";
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
    scheduleBot();
  }
};
$("#flip").onclick = () => {
  flipped = !flipped;
  $("#auto-flip").checked = false;
  pref.autoFlip = false;
  savePreferences();
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
    scheduleBot();
    return;
  }
  cancelBot();
  replaying = true;
  const token = ++replayToken;
  $("#replay").textContent = "Stop replay";
  try {
    await loadPositions();
    document.dispatchEvent(new CustomEvent("utxoplay:close-menu"));
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
      scheduleBot();
    }
  }
};
function confirmAction(title, copy) {
  if (choosing) return Promise.resolve(false);
  choosing = true;
  cancelBot();
  return new Promise((resolve) => {
    const d = $("#confirm-action");
    $("#confirm-title").textContent = title;
    $("#confirm-copy").textContent = copy;
    const done = (v) => {
      d.close();
      choosing = false;
      resolve(v);
      if (!v) scheduleBot();
    };
    $("#confirm-yes").onclick = () => done(true);
    $("#confirm-cancel").onclick = () => done(false);
    d.oncancel = () => {
      choosing = false;
      resolve(false);
      scheduleBot();
    };
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
    !!data.game.result ||
    reviewIndex !== null ||
    replaying ||
    botTurn() ||
    !roomTurn() ||
    busy;
  $("#draw").disabled = reviewIndex !== null || replaying || botTurn() || busy;
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
  updateTable();
  const side = data.game.turn === "white" ? "White" : "Black";
  $("#status").textContent =
    reviewIndex === null
      ? data.game.result
        ? data.game.result.replace(/([a-z])([A-Z])/g, "$1 $2")
        : side + " to move" + (data.game.in_check ? " · check" : "")
      : `Review · ply ${reviewIndex} · ${positions[reviewIndex].split(" ")[1] === "w" ? "White" : "Black"} to move`;
  $("#hint").textContent =
    reviewIndex === null
      ? "Select a piece to see its legal moves."
      : "Viewing a saved position. Return to Live to continue playing.";
}
async function loadPositions() {
  if (positions) return;
  const key = data.session.id + data.session.block_hash;
  const r = await api(endpoint("replay"), {});
  if (key !== data.session.id + data.session.block_hash)
    throw Error("The match changed. Review the current match again.");
  if (r.verified !== true || !Array.isArray(r.positions))
    throw Error("The saved match could not be verified.");
  positions = r.positions;
  $("#verification").textContent =
    `✓ ${r.frames} signed frames replayed. State matches.`;
}
async function review(i) {
  if (!data || busy || replaying) return;
  cancelBot();
  busy = true;
  try {
    await loadPositions();
    reviewIndex = Math.max(0, Math.min(i, positions.length - 1));
    selected = null;
    showBoard();
    document.dispatchEvent(new CustomEvent("utxoplay:close-menu"));
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
    scheduleBot();
  } else review(reviewIndex + 1);
};
$("#review-live").onclick = () => {
  reviewIndex = null;
  showBoard();
  scheduleBot();
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
  if (e.key === "ArrowLeft" && !e.target.closest("#board")) {
    e.preventDefault();
    $("#review-prev").click();
  }
  if (e.key === "ArrowRight" && !e.target.closest("#board")) {
    e.preventDefault();
    $("#review-next").click();
  }
});
$("#sound").onclick = async () => {
  $("#sound").disabled = true;
  const on = await toggleSound();
  $("#sound").disabled = false;
  $("#sound").textContent = on ? "♫ Sound on" : "♫ Sound off";
  $("#sound").setAttribute("aria-pressed", on);
};
$("#volume").oninput = (e) => volume(+e.target.value / 100);
$("#credits-open").onclick = () => $("#credits").showModal();
$("#credits-close").onclick = () => $("#credits").close();
async function refresh() {
  if (busy || choosing) return;
  busy = true;
  cancelBot();
  $("#retry").disabled = true;
  try {
    data = await api(endpoint("state"));
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
    busy = false;
    if (data) reviewControls();
    scheduleBot();
  }
}
$("#retry").onclick = () => roomId ? joinRoom(roomId) : refresh();

function readBoard(fen) {
  const map = {};
  fen
    .split(" ")[0]
    .split("/")
    .forEach((row, y) => {
      let x = 0;
      for (const p of row) {
        if (/[1-8]/.test(p)) x += +p;
        else map["abcdefgh"[x++] + (8 - y)] = p;
      }
    });
  return map;
}
function savePreferences() {
  try {
    localStorage.setItem("chess:preferences", JSON.stringify(pref));
  } catch {}
}
function botTurn() {
  return (
    !!data &&
    !roomId &&
    pref.opponent !== "local" &&
    data.game.turn !== pref.color &&
    !data.game.result
  );
}
function cancelBot() {
  clearTimeout(botTimer);
  clearTimeout(botTimeout);
  worker?.terminate();
  worker = null;
  botEpoch++;
}
function updateTable() {
  if (!data) return;
  $("#board-review").hidden = reviewIndex === null;
  $("#board-review-label").textContent =
    `${reviewIndex ?? data.game.moves.length} / ${data.game.moves.length}`;
  $("#board-prev").disabled = replaying || reviewIndex === 0;
  $("#board-next").disabled = replaying;
  $("#board-live").textContent = replaying ? "Stop replay" : "Return to live";
  $("#board-feedback").hidden = reviewIndex !== null;
  $("#table-mode").textContent =
    roomId ? "ONLINE TABLE ↗" : pref.opponent === "local"
      ? "PASS & PLAY ↗"
      : `COMPUTER · ${{ rookie: "GENTLE", club: "CLUB", expert: "FOCUSED" }[pref.opponent]} ↗`;
  $("#board").dataset.hints = String(pref.hints);
  $("#board-feedback").textContent =
    reviewIndex !== null
      ? `REVIEW · MOVE ${Math.ceil(reviewIndex / 2)} · RETURN TO LIVE IN MOVES`
      : data.game.result
        ? "MATCH COMPLETE"
        : botTurn()
          ? "YOUR PARTNER IS CONSIDERING A MOVE"
          : roomId ? !roomConnected ? "RECONNECTING TO YOUR TABLE" : !data.room?.ready ? "INVITE A FRIEND · YOUR TABLE IS READY" : roomTurn() ? "YOUR MOVE · TAKE YOUR TIME" : "YOUR FRIEND IS CONSIDERING A MOVE" : "TAP OR DRAG A PIECE";
  const visibleTurn =
    reviewIndex === null
      ? data.game.turn
      : positions[reviewIndex].split(" ")[1] === "w"
        ? "white"
        : "black";
  for (const color of ["white", "black"]) {
    $("." + color + "-player").classList.toggle(
      "active",
      color === visibleTurn && (reviewIndex !== null || !data.game.result),
    );
    $("#" + color + "-state").textContent =
      reviewIndex !== null
        ? color === visibleTurn
          ? "Saved position · to move"
          : "Saved position"
        : color === data.game.turn && !data.game.result
          ? "Considering the next move"
          : data.game.result
            ? "Match complete"
            : "Waiting for the reply";
  }
  for (const color of ["white", "black"])
    $("." + color + "-player strong").textContent =
      (roomId ? data.room?.players[color]?.name || "Open seat" : color === "white" ? "Ivory" : "Jade") +
      (roomId ? (data.room?.color===color ? " · You" : "") : pref.opponent === "local"
        ? ""
        : color === pref.color
          ? " · You"
          : " · Stockfish");
  $("#resign").disabled=!!data.game.result || !roomTurn();
  $("#draw").disabled=!roomTurn();
  $("#table-invite").hidden=!roomId;
  $("#online-room").hidden=!roomId;
  $("#online-status").textContent=roomId ? !roomConnected ? "Reconnecting… your table is saved." : data.room?.ready ? "Both seats are ready. Moves sync automatically." : "Your friend can take the open seat using this invitation." : "";
  $("#invite-link").value=roomId ? location.origin+location.pathname+"#table="+roomId : "";
  $("#match-export").href=endpoint("export");
  $("#auto-flip").disabled=!!roomId;
}
function botError(message) {
  cancelBot();
  botFailed = true;
  $("#bot-retry").hidden = false;
  $("#board-feedback").textContent = "COMPUTER PAUSED";
  toast(message);
}
function scheduleBot() {
  clearTimeout(botTimer);
  if (
    !data ||
    busy ||
    choosing ||
    replaying ||
    reviewIndex !== null ||
    !botTurn() ||
    botFailed ||
    document.hidden ||
    menuOpen ||
    document.querySelector("dialog[open]") ||
    worker
  )
    return;
  botTimer = setTimeout(() => {
    if (
      busy ||
      choosing ||
      replaying ||
      reviewIndex !== null ||
      !botTurn() ||
      document.hidden ||
      menuOpen ||
      document.querySelector("dialog[open]")
    )
      return;
    if (data.game.can_claim_draw) {
      act({ type: "claim_draw" }, true);
      return;
    }
    const key = data.session.id + data.session.block_hash,
      id = ++botEpoch;
    updateTable();
    try {
      worker={terminate:()=>engine.cancel()};
      botTimeout=setTimeout(()=>botError("Stockfish is taking longer to load. Reconnect and resume the computer."),30000);
      engine.run({moves:data.game.moves,level:pref.opponent,
        onError:message=>botError(message),
        onMove:move=>{
          if(id!==botEpoch)return;
          cancelBot();
          if(key!==data.session.id+data.session.block_hash || !botTurn() || reviewIndex!==null || replaying || choosing || busy || menuOpen || document.hidden)return;
          if(!data.game.legal_moves.includes(move)){botError("The engine move was unavailable. Resume to try again.");return;}
          act({type:"move",uci:move},true);
        }});
    } catch {
      botError(
        "This browser could not start the training worker. Pass & play remains available.",
      );
    }
  }, 450);
}
function animateMove(move) {
  if (
    !move ||
    !pref.motion ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const dest = $(`[data-square="${move.slice(2, 4)}"] .piece`),
    from = $(`[data-square="${move.slice(0, 2)}"]`);
  if (!dest || !from) return;
  const a = from.getBoundingClientRect(),
    b = dest.getBoundingClientRect();
  dest.animate?.(
    [
      {
        transform: `translate(${a.left - b.left}px,${a.top - b.top}px) scale(1.08)`,
      },
      { transform: "translate(0,0) scale(1)" },
    ],
    { duration: 230, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
}
let drag = null,
  suppressClick = false;
function boardBounds() {
  const cells = $("#board").children,
    a = cells[0].getBoundingClientRect(),
    b = cells[63].getBoundingClientRect();
  return {
    left: a.left,
    top: a.top,
    right: b.right,
    bottom: b.bottom,
    width: b.right - a.left,
    height: b.bottom - a.top,
  };
}
function endDrag(event, cancel = false) {
  if (!drag || drag.id !== event.pointerId) return;
  const current = drag;
  drag = null;
  current.ghost?.remove();
  document
    .querySelectorAll(".drag-source,.drop-target")
    .forEach((e) => e.classList.remove("drag-source", "drop-target"));
  if (current.moved) {
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (!cancel) {
      const sq = squareAt(event.clientX, event.clientY, boardBounds(), flipped);
      if (sq) select(sq, readBoard(data.game.fen)[sq]);
    }
  }
}
function initializeTable() {
  $("#board-prev").onclick = () => $("#review-prev").click();
  $("#board-next").onclick = () => $("#review-next").click();
  $("#board-live").onclick = () =>
    $(replaying ? "#replay" : "#review-live").click();
  $("#volume").value = String(Math.round(savedVolume() * 100));
  $("#opponent").value = roomId ? "online" : pref.opponent;
  $("#human-color").value = pref.color;
  $("#auto-flip").checked = pref.autoFlip;
  $("#show-hints").checked = pref.hints;
  $("#piece-motion").checked = pref.motion;
  flipped = pref.opponent !== "local" && pref.color === "black";
  const describe = () => {
    $("#human-color").disabled = $("#opponent").value === "local";
    $("#mode-description").textContent =
      $("#opponent").value === "online" ? "A private table for two browsers. Share the invitation. Your seat and moves are saved; no clock." : $("#opponent").value === "local"
        ? "Two people, one device. Opponent choices apply when you start a fresh game."
        : "Stockfish 17.1 Lite runs in a separate worker on your device. No clock or rated Elo. Choices apply to your next fresh game.";
  };
  describe();
  $("#opponent").onchange = describe;
  for (const [id, key] of [
    ["show-hints", "hints"],
    ["piece-motion", "motion"],
    ["auto-flip", "autoFlip"],
  ])
    $("#" + id).addEventListener("change", () => {
      pref[key] = $("#" + id).checked;
      savePreferences();
      if (data) showBoard();
    });
  $("#table-mode").onclick = $("#journal-open").onclick = () =>
    document.dispatchEvent(
      new CustomEvent("utxoplay:open-menu", { detail: { view: "game" } }),
    );
  $("#quick-flip").onclick = () => $("#flip").click();
  $("#bot-retry").onclick = () => {
    botFailed = false;
    $("#bot-retry").hidden = true;
    scheduleBot();
  };
  $("#save-pgn").onclick = () => {
    if (!data) return;
    const result = data.game.result?.startsWith("White")
      ? "1-0"
      : data.game.result?.startsWith("Black")
        ? "0-1"
        : data.game.result
          ? "1/2-1/2"
          : "*";
    const text =
      '[Event "UTXOPlay Conservatory"]\n[Result "' +
      result +
      '"]\n\n' +
      record.pgn.replace(/\s+\*$/, "") +
      " " +
      result +
      "\n";
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([text], { type: "application/x-chess-pgn" }),
      );
    a.href = url;
    a.download = "quiet-board.pgn";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  document.addEventListener("utxoplay:menu", (e) => {
    menuOpen = e.detail.open;
    if (menuOpen) {
      cancelBot();
      selected = null;
      if (data) showBoard();
    } else scheduleBot();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelBot();
    else scheduleBot();
  });
  document
    .querySelectorAll("dialog")
    .forEach((d) => d.addEventListener("close", () => scheduleBot()));
  addEventListener("pagehide", cancelBot);
  addEventListener("pageshow", () => scheduleBot());
  const el = $("#board");
  el.addEventListener("keydown", (e) => {
    const cell = e.target.closest("[data-square]");
    if (!cell) return;
    const i = [...el.children].indexOf(cell),
      delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[
        e.key
      ];
    if (delta !== undefined) {
      e.preventDefault();
      e.stopPropagation();
      const n = i + delta;
      if (
        n >= 0 &&
        n < 64 &&
        (Math.abs(delta) === 8 || Math.floor(i / 8) === Math.floor(n / 8))
      ) {
        cell.tabIndex = -1;
        el.children[n].tabIndex = 0;
        el.children[n].focus();
      }
    }
  });
  el.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest("[data-square]");
    if (
      !cell ||
      e.button !== 0 ||
      drag ||
      !data ||
      busy ||
      choosing ||
      botTurn() ||
    !roomTurn() ||
      replaying ||
      reviewIndex !== null ||
      data.game.result
    )
      return;
    const p = cell.dataset.piece;
    if (!p || (p === p.toUpperCase()) !== (data.game.turn === "white")) return;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      cell,
      p,
      moved: false,
    };
    cell.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      drag.moved = true;
      selected = drag.cell.dataset.square;
      board();
      drag.cell.classList.add("drag-source");
      const ghost = document.createElement("div");
      ghost.className = "drag-piece";
      const size = drag.cell.getBoundingClientRect().width;
      ghost.style.width = ghost.style.height = size + "px";
      ghost.style.backgroundPosition = `${(sprite[drag.p.toLowerCase()] * 100) / 5}% ${drag.p === drag.p.toUpperCase() ? 0 : 100}%`;
      $(".table").append(ghost);
      drag.ghost = ghost;
    }
    if (drag.ghost) {
      drag.ghost.style.left = e.clientX + "px";
      drag.ghost.style.top = e.clientY + "px";
      document.querySelector(".drop-target")?.classList.remove("drop-target");
      const sq = squareAt(e.clientX, e.clientY, boardBounds(), flipped);
      if (sq) $(`[data-square="${sq}"]`)?.classList.add("drop-target");
    }
  });
  el.addEventListener("pointerup", (e) => endDrag(e));
  el.addEventListener("pointercancel", (e) => endDrag(e, true));
  el.addEventListener("lostpointercapture", (e) => endDrag(e, true));
  addEventListener("blur", () => {
    if (drag) endDrag({ pointerId: drag.id }, true);
  });
}

function disconnectRoom(){roomStream?.close();roomStream=null;roomConnected=false;}
function receiveRoom(next){
  if(!roomId||next.room?.id!==roomId)return;
  const changed=next.session.block_hash!==data?.session.block_hash;
  const previous=data;
  data=next;
  if(changed){
    selected=null;positions=null;reviewIndex=null;replaying=false;replayToken++;
    if(drag)endDrag({pointerId:drag.id},true);
    if(choosing){$("#promotion-cancel").click();choosing=false;}
    render();
    if(previous&&next.game.moves.length>previous.game.moves.length){sound(next.game.result?"win":"move");animateMove(next.game.moves.at(-1));}
  }else updateTable();
}
function connectRoom(){
  disconnectRoom();if(!roomId||document.hidden)return;
  const expected=roomId;
  roomStream=new EventSource(endpoint("events"));
  roomStream.onopen=()=>{if(roomId===expected){roomConnected=true;updateTable();}};
  roomStream.addEventListener("position",event=>{
    if(roomId!==expected)return;
    try{roomConnected=true;if(!busy)receiveRoom(JSON.parse(event.data));}catch{toast("Reconnecting to the latest board…");}
  });
  roomStream.onerror=()=>{if(roomId===expected){roomConnected=false;updateTable();}};
}
async function enterRoom(next){
  cancelBot();disconnectRoom();roomId=next.room.id;data=next;
  flipped=next.room.color==="black";selected=null;reviewIndex=null;positions=null;replaying=false;replayToken++;
  history.replaceState(null,"",location.pathname+"#table="+roomId);
  $("#opponent").value="online";$("#human-color").value=next.room.color;
  render();connectRoom();
  document.dispatchEvent(new CustomEvent("utxoplay:close-menu"));
  globalThis.UTXOPlayLoader?.session();globalThis.UTXOPlayLoader?.ready();
}
async function createRoom(){
  if(busy)return;
  busy=true;cancelBot();
  try{await enterRoom(await api("/games/chess/api/rooms",{color:$("#human-color").value}));toast("Your table is ready. Copy the invitation for your friend.");}
  catch(e){toast(e.message);}finally{busy=false;}
}
async function joinRoom(id){
  if(busy)return;
  if(!/^[a-f0-9]{24}$/.test(id||"")){toast("Paste a Quiet Board invitation link.");return;}
  busy=true;cancelBot();
  try{await enterRoom(await api(`/games/chess/api/rooms/${id}/join`,{}));}
  catch(e){toast(e.message);$("#connection").hidden=false;if(!data)globalThis.UTXOPlayLoader?.fail("session");}
  finally{busy=false;}
}
async function startTable(){
  try{
    const me=await api("/api/me");if(!me.user)await api("/api/guest",{});
    if(roomId){await joinRoom(roomId);return;}
    await refresh();
  }catch(e){globalThis.UTXOPlayLoader?.fail("session");toast(e.message);$("#connection").hidden=false;}
}
$("#join-table").onclick=()=>{
  const input=$("#join-code").value.trim();let id=input;
  try{const url=new URL(input);if(url.origin!==location.origin)throw Error();id=new URLSearchParams(url.hash.slice(1)).get("table");}catch{}
  void joinRoom(id);
};
async function copyInvitation(){
  if(!roomId)return;
  try{await navigator.clipboard.writeText(location.origin+location.pathname+"#table="+roomId);toast("Invitation copied. Send it to your friend.");}
  catch{document.dispatchEvent(new CustomEvent("utxoplay:open-menu",{detail:{view:"game"}}));$("#invite-link").focus();$("#invite-link").select();toast("Select and copy the invitation link.");}
}
$("#copy-invite").onclick=$("#table-invite").onclick=copyInvitation;
$("#recent-tables").onclick=async()=>{
  try{
    const {rooms}=await api("/games/chess/api/rooms");$("#recent-list").replaceChildren();
    for(const room of rooms){const button=document.createElement("button");button.textContent=`${new Date(room.created).toLocaleDateString()} · ${room.color} · ${room.ready?"Two players":"Waiting for friend"}`;button.onclick=()=>joinRoom(room.id);$("#recent-list").append(button);}
    if(!rooms.length)$("#recent-list").textContent="Your online tables will appear here.";
  }catch(e){toast(e.message);}
};
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){disconnectRoom();engine.dispose();}else if(roomId)connectRoom();
});
addEventListener("pagehide",()=>{disconnectRoom();engine.dispose();});
addEventListener("hashchange",()=>location.reload());

initializeTable();
await startTable();
startPolling(
  async () => {
    const before = data;
    if (
      roomId ||
      busy ||
      worker ||
      choosing ||
      replaying ||
      reviewIndex !== null ||
      selected ||
      document.hidden
    )
      return;
    try {
      const next = await api(endpoint("state"));
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
        cancelBot();
        render();
        scheduleBot();
      }
    } catch {}
  },
  { interval: 5000 },
);
