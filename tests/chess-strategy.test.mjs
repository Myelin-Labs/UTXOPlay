import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import {
  chooseMove,
  notation,
  squareAt,
  preferences,
  uci,
} from "../games/chess/client/strategy.mjs";
test("all 64 squares invert the displayed geometry in both orientations and wide layouts", () => {
  for (const size of [354, 818, 950, 1310, 1600])
    for (const flip of [false, true]) {
      const r = {
        left: 47,
        top: 91,
        width: size,
        height: size,
        right: 47 + size,
        bottom: 91 + size,
      };
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          assert.equal(
            squareAt(
              r.left + ((x + 0.5) * size) / 8,
              r.top + ((y + 0.5) * size) / 8,
              r,
              flip,
            ),
            "abcdefgh"[flip ? 7 - x : x] + (flip ? y + 1 : 8 - y),
          );
      for (const [x, y] of [
        [r.right, r.top],
        [r.left - 1, r.top],
        [r.left, r.bottom],
      ])
        assert.equal(squareAt(x, y, r, flip), null);
    }
});
test("training never leaves the authoritative root move set", () => {
  const g = new Chess();
  for (const level of ["rookie", "club", "expert"]) {
    const legal = ["a2a3", "h2h3"];
    assert.ok(
      legal.includes(
        chooseMove({ fen: g.fen(), legal, level, random: () => 0 }),
      ),
    );
  }
  assert.equal(chooseMove({ fen: g.fen(), legal: [] }), null);
});
test("training finds mate rather than taking material", () => {
  const g = new Chess("7k/5Q2/6K1/8/8/8/8/8 w - - 0 1");
  const move = chooseMove({
    fen: g.fen(),
    legal: g.moves({ verbose: true }).map(uci),
    level: "club",
  });
  g.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
  assert.equal(g.isCheckmate(), true);
});
test("notation preserves SAN castling and mate", () => {
  assert.deepEqual(notation(["f2f3", "e7e5", "g2g4", "d8h4"]).san, [
    "f3",
    "e5",
    "g4",
    "Qh4#",
  ]);
  assert.equal(
    notation(["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"]).san.at(
      -1,
    ),
    "O-O",
  );
});
test("corrupt preferences cannot start an unknown opponent or color", () => {
  for (const raw of [
    null,
    5,
    "bad",
    {},
    { opponent: "constructor", color: "purple" },
  ])
    assert.deepEqual(preferences(raw), {
      opponent: "local",
      color: "white",
      motion: true,
      hints: true,
      autoFlip: false,
    });
});
