import { copyFileSync } from "node:fs";
for (const game of ["chess", "sling", "teeworlds", "arcade", "neon-miner"])
  copyFileSync(
    "shared/game-performance.mjs",
    `games/${game}/web/performance.mjs`,
  );

for (const game of ["arcade", "sling", "teeworlds", "neon-miner", "openstrike"])
  copyFileSync("shared/game-viewport.mjs", `games/${game}/web/viewport.mjs`);
