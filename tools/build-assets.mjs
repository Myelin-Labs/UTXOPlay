import { copyFileSync } from "node:fs";
for (const game of ["chess", "sling", "teeworlds", "arcade", "neon-miner"])
  copyFileSync(
    "shared/game-performance.mjs",
    `games/${game}/web/performance.mjs`,
  );
