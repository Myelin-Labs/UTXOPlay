import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import {createGame,step,sameState} from '../games/neon-miner/web/engine.mjs';import {campaign} from './miner-solver.mjs';
const bin=process.env.MINER_BIN||'games/neon-miner/target/debug/myelin-neon-miner';
function native(input){const r=spawnSync(bin,['simulate'],{input:JSON.stringify({kind:'neon-miner',...input}),encoding:'utf8',maxBuffer:8e6});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
for(let trial=0;trial<40;trial++){const g=createGame(),inputs=[];let seed=trial+3;for(let n=0;n<2400;n++){seed=seed*16807%2147483647;const i=trial<16?trial:seed%16;inputs.push(i);step(g,i);}assert.deepEqual(native({inputs}),g,`Tape ${trial}`);}
for(const purchases of [false,true]){const {g,actions,sectors}=campaign({purchases});assert.equal(sectors,20);assert.deepEqual(native({actions}),g);assert.ok(sameState(native({actions}),g));console.log(`20-sector campaign, purchases=${purchases}: ${g.tick} ticks / ${g.score} score / ${g.coins} credits`);}
console.log('40 random/held-input tapes and two full 20-sector campaigns match Rust exactly.');
