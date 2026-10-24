import { Chess } from "chess.js";
export const levels = {
  rookie: { depth: 2, ms: 180, nodes: 2500, choices: 4 },
  club: { depth: 3, ms: 420, nodes: 9000, choices: 1 },
  expert: { depth: 4, ms: 800, nodes: 22000, choices: 1 },
};
const value = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
export const uci = (m) => m.from + m.to + (m.promotion || "");
export function notation(moves) {
  const game = new Chess(),
    san = [];
  for (const move of moves) {
    const m = game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4],
    });
    san.push(m.san);
  }
  return { san, pgn: game.pgn() };
}
export function squareAt(x, y, rect, flipped = false) {
  if (
    x < rect.left ||
    y < rect.top ||
    x >= rect.right ||
    y >= rect.bottom ||
    rect.width <= 0 ||
    rect.height <= 0
  )
    return null;
  const col = Math.floor(((x - rect.left) / rect.width) * 8),
    row = Math.floor(((y - rect.top) / rect.height) * 8);
  return "abcdefgh"[flipped ? 7 - col : col] + (flipped ? row + 1 : 8 - row);
}
export function preferences(raw = {}) {
  if (!raw || typeof raw !== "object") raw = {};
  return {
    opponent: Object.hasOwn(levels, raw.opponent) ? raw.opponent : "local",
    color: raw.color === "black" ? "black" : "white",
    motion: raw.motion !== false,
    hints: raw.hints !== false,
    autoFlip: raw.autoFlip === true,
  };
}
export function chooseMove({
  fen,
  legal,
  level = "club",
  random = Math.random,
}) {
  const config = levels[level] || levels.club,
    game = new Chess(fen),
    deadline = performance.now() + config.ms;
  let nodes = 0;
  const roots = game
    .moves({ verbose: true })
    .filter((m) => legal.includes(uci(m)));
  if (!roots.length) return null;
  const order = (m) =>
    (m.captured ? 10 * value[m.captured] - value[m.piece] : 0) +
    (m.promotion ? value[m.promotion] : 0) +
    (m.san.includes("+") ? 35 : 0);
  const ordered = (moves) => moves.sort((a, b) => order(b) - order(a));
  function evaluate() {
    let sum = 0;
    for (const row of game.board())
      for (const p of row)
        if (p) {
          const file = p.square.charCodeAt(0) - 97,
            rank = Number(p.square[1]) - 1,
            advance = p.color === "w" ? rank : 7 - rank,
            center = 7 - Math.abs(file - 3.5) - Math.abs(rank - 3.5);
          const positional =
            p.type === "p"
              ? advance * 9 + center * 3
              : ["n", "b"].includes(p.type)
                ? center * 12
                : p.type === "k"
                  ? -center * 3
                  : center * 2;
          sum += (value[p.type] + positional) * (p.color === "w" ? 1 : -1);
        }
    return sum * (game.turn() === "w" ? 1 : -1);
  }
  function search(depth, alpha, beta, ply) {
    if (++nodes > config.nodes || performance.now() > deadline) throw "budget";
    if (game.isCheckmate()) return -100000 + ply;
    if (game.isStalemate()) return 0;
    if (!depth) return evaluate();
    let best = -Infinity;
    for (const m of ordered(game.moves({ verbose: true }))) {
      game.move(m);
      let score;
      try {
        score = -search(depth - 1, -beta, -alpha, ply + 1);
      } finally {
        game.undo();
      }
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }
  let ranked = ordered(roots).map((m) => ({ m, score: order(m) }));
  for (let depth = 1; depth <= config.depth; depth++) {
    const iteration = [];
    try {
      for (const { m } of ranked) {
        game.move(m);
        let score;
        try {
          score = -search(depth - 1, -Infinity, Infinity, 1);
        } finally {
          game.undo();
        }
        iteration.push({ m, score });
      }
      ranked = iteration.sort((a, b) => b.score - a.score);
    } catch {
      break;
    }
  }
  const candidates = ranked
    .filter((r) => r.score >= ranked[0].score - (level === "rookie" ? 180 : 0))
    .slice(0, config.choices);
  return uci(
    candidates[
      Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
    ].m,
  );
}
