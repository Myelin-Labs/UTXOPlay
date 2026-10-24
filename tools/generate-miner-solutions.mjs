// Regenerate the canonical native/browser full-campaign fixture from current rules.
import{writeFileSync}from'node:fs';import{campaign}from'../tests/miner-solver.mjs';
const{g,actions,sectors}=campaign();writeFileSync(new URL('../tests/neon-miner-solutions.json',import.meta.url),JSON.stringify(actions));console.log({sectors,ticks:g.tick,actions:actions.length,recoveries:g.lives});
