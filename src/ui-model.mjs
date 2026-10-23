export const genres = [
  "All games",
  "Action",
  "Arcade",
  "Strategy",
  "Puzzle",
  "Other",
];
export function selectGames(
  games,
  { query = "", genre = "All games", mode = "all", freeOnly = false } = {},
) {
  const q = query.trim().toLocaleLowerCase();
  return games.filter(
    (g) =>
      (!freeOnly || g.pricing !== "paid") &&
      (genre === "All games" || g.genre === genre) &&
      (!q ||
        `${g.title} ${g.description} ${g.genre} ${g.mode}`
          .toLocaleLowerCase()
          .includes(q)) &&
      (mode === "all" ||
        (mode === "solo" &&
          (g.vendor
            ? ["Single player", "Solo + multiplayer"].includes(g.mode)
            : g.id !== "chess")) ||
        (mode === "friends" &&
          (g.vendor ? g.mode !== "Single player" : g.mode !== "Single-player"))),
  );
}
export function accountLabel(user) {
  return !user
    ? "No account needed"
    : user.guest
      ? "Guest on this browser"
      : "Wallet connected";
}
export function apiError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError")
    return "This is taking longer than expected. Please try again.";
  if (error instanceof TypeError)
    return "We couldn’t reach UTXOPlay. Check your connection and try again.";
  return error?.message || "Something went wrong. Please try again.";
}
export const gameMeta = {
  "prism-breaker": {"accent": "#b7a2ff", "tag": "REFRACTION LAB", "length": "Quick arcade runs", "input": "Keyboard + touch", "note": "Find the angle. Break the spectrum.", "repo": "UTXOPlay"},
  "neon-coil": {"accent": "#84efba", "tag": "LIVING CIRCUIT", "length": "Quick arcade runs", "input": "Keyboard + touch", "note": "A little hunger. A longer circuit.", "repo": "UTXOPlay"},
  "starfall": {"accent": "#7edaff", "tag": "ORBITAL DEFENCE", "length": "Quick arcade runs", "input": "Keyboard + touch", "note": "Hold the line. Light up the night.", "repo": "UTXOPlay"},
  "drift-run": {"accent": "#ffbc83", "tag": "AFTER HOURS", "length": "Quick arcade runs", "input": "Keyboard + touch", "note": "Three lanes. One way forward.", "repo": "UTXOPlay"},
  openstrike: {
    accent: "#68c8ed",
    tag: "NEON DIVIDE",
    length: "90-second rounds",
    input: "Keyboard + mouse",
    note: "A first-person duel. Desktop recommended.",
    repo: "myelin-openstrike",
  },
  teeworlds: {
    accent: "#adce67",
    tag: "GRASSLAND ARENA",
    length: "60-second rounds",
    input: "Keyboard + mouse",
    note: "Practice solo or invite a friend to a private room.",
    repo: "myelin-teeworlds",
  },
  sling: {
    accent: "#ffc77b",
    tag: "THE FLOATING GARDENS",
    length: "Play at your pace",
    input: "Mouse or touch",
    note: "Twelve islands, three helpful items, and a sky full of music.",
    repo: "myelin-sling",
  },
  chess: {
    accent: "#ceb6fc",
    tag: "THE QUIET BOARD",
    length: "Play at your pace",
    input: "Mouse or touch",
    note: "Two players share a board on the same device.",
    repo: "myelin-chess",
  },
};
