import { copyFileSync } from "node:fs";
for (const game of ["chess", "sling", "teeworlds", "arcade"])
  copyFileSync(
    "shared/game-performance.mjs",
    `games/${game}/web/performance.mjs`,
  );
