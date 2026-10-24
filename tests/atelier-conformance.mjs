import assert from 'node:assert/strict';import{spawnSync}from'node:child_process';
import{createGame,step,kinds}from'../games/atelier/web/engine.mjs';
const bin=process.env.ATELIER_BIN||'games/arcade/target/debug/myelin-atelier';let count=0;
export function puzzleTape(){const g=createGame('lumen-weave'),inputs=[];const push=i=>{inputs.push(i);step(g,i);};while(!g.over){const level=g.level;for(let n=0;n<18&&!g.phase&&!g.over;n++){const x=n%6,y=Math.floor(n/6);while(g.x!==x||g.y!==y){const i=g.x!==x?(g.x>x?1:2):(g.y>y?4:8);for(let k=0;k<6;k++)push(i);}for(let t=0,turns=(4-g.aux[n])%4;t<turns&&!g.phase&&!g.over;t++){push(16);push(0);}}while(g.phase&&!g.over)push(0);assert.ok(g.level!==level||g.over,'solver must advance');}return{kind:g.kind,inputs,game:g};}
function verify(kind,inputs,g){const r=spawnSync(bin,['simulate'],{input:JSON.stringify({kind,inputs}),encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(r.stdout),g,kind+' tape '+count);count++;}
for(const kind of kinds)for(let trial=0;trial<24;trial++){let seed=trial+1;const g=createGame(kind),inputs=[];for(let n=0;n<2400;n++){seed=seed*16807%2147483647;const i=trial<8?[0,1,2,4,8,16,31,3][trial]:seed%32;inputs.push(i);step(g,i);}verify(kind,inputs,g);}
const p=puzzleTape();assert.equal(p.game.level,24);assert.ok(p.game.won);verify(p.kind,p.inputs,p.game);
{const g=createGame('lumen-weave'),inputs=[];for(let n=0;n<1800;n++){const i=64+(n*13)%36;inputs.push(i);step(g,i);}verify(g.kind,inputs,g);}
console.log(`${count} native/browser full-state tapes match; all 24 Lumen Weave chapters solved from genesis (${p.inputs.length} ticks).`);
