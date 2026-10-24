// Requires the matching Rust binary: cargo build --locked --manifest-path games/arcade/Cargo.toml
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createGame,step,kinds} from '../games/arcade/web/engine.mjs';
const bin=process.env.ARCADE_BIN||'games/arcade/target/debug/myelin-arcade';
let count=0;
for(const kind of kinds){
 for(let trial=0;trial<36;trial++){
  let seed=trial+1;const inputs=[],g=createGame(kind);
  for(let tick=0;tick<1800;tick++){
   seed=(seed*16807)%2147483647;
   let i=seed%32;
   if(trial<12)i=[0,1,2,4,8,16,17,18,31,3,12,24][trial];
   if(trial===12&&kind==='prism-breaker'){i=g.bodies[0].x<g.x-12?1:g.bodies[0].x>g.x+12?2:0;}
   if(trial===12&&kind==='neon-coil'){const [x,y]=g.trail[0];i=y===0&&x<19?2:x===19&&y<19?8:y===19&&x>0?1:x===0&&y>0?4:2;}
   inputs.push(i);step(g,i);
  }
  const result=spawnSync(kind==='prism-breaker'?(process.env.PRISM_BIN||'deploy/bin/myelin-prism-breaker'):bin,['simulate'],{input:JSON.stringify({kind,inputs}),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),g,`${kind} trial ${trial}`);count++;
 }
}
console.log(`${count} full-state Rust/browser conformance tapes passed (259,200 input ticks).`);
