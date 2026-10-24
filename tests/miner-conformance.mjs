import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import {createGame,step,sameState} from '../games/neon-miner/web/engine.mjs';import {campaign} from './miner-solver.mjs';
const bin=process.env.MINER_BIN||'games/neon-miner/target/debug/myelin-neon-miner';
function native(input){const r=spawnSync(bin,['simulate'],{input:JSON.stringify({kind:'neon-miner',...input}),encoding:'utf8',maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
for(let trial=0;trial<64;trial++){const g=createGame(),inputs=[];let seed=trial+3;for(let n=0;n<2400;n++){seed=seed*16807%2147483647;const i=trial<32?trial:seed%32;inputs.push(i);step(g,i);}assert.deepEqual(native({inputs}),g,`Tape ${trial}`);}
for(const stasis of [false,true]){const {g,actions,sectors}=campaign({stasis});assert.equal(sectors,60);assert.deepEqual(native({actions}),g);assert.ok(sameState(native({actions}),g));console.log(`60-sector campaign, stasis=${stasis}: ${g.tick} ticks / ${g.score} score / ${g.coins} credits`);}
console.log('64 random/held-input tapes and two full 60-sector campaigns match Rust exactly.');
