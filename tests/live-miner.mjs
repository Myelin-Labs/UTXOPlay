// Exercises the real gateway and authority, then verifies the exact export offline.
import {spawnSync} from 'node:child_process';import {mkdtempSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {nextHaul} from './miner-solver.mjs';
const base=process.env.STORE_URL||'http://127.0.0.1:19091',bin=process.env.MINER_BIN||'games/neon-miner/target/debug/myelin-neon-miner';
async function guest(){const r=await fetch(base+'/api/guest',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);return r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');}
const cookie=await guest(),second=await guest();
let lastPost=0;
async function req(endpoint,body,jar=cookie,status=200){if(body!==undefined){await new Promise(r=>setTimeout(r,Math.max(0,550-(Date.now()-lastPost))));lastPost=Date.now();}const r=await fetch(base+'/games/neon-miner/api/'+endpoint,{method:body===undefined?'GET':'POST',headers:{Origin:base,Cookie:jar,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
let state=await req('state'),other=await req('state',undefined,second);assert.notEqual(state.session.id,other.session.id);const initial=state;
const action=async(a)=>{state=await req('action',{session_id:state.session.id,expected_block:state.session.block_hash,action:a});return state;};
await req('action',{session_id:state.session.id,expected_block:state.session.block_hash,action:{type:'buy',item:'emp',price:0}},cookie,400);
assert.equal((await req('state')).session.block_hash,state.session.block_hash);
let purchases=0;while(state.game.mode!=='complete'){
 if(state.game.mode==='mining'){
  const prediction=structuredClone(state.game),inputs=nextHaul(prediction);for(let n=0;n<inputs.length;n+=60)await action({type:'ticks',inputs:inputs.slice(n,n+60)});assert.deepEqual(state.game,prediction);
 }else if(state.game.mode==='cleared'){
  if(state.game.level===1){const before=state;const buy={session_id:state.session.id,expected_block:state.session.block_hash,action:{type:'buy',item:'overdrive'}};state=await req('action',buy);assert.equal(state.game.coins,before.game.coins-18);await req('action',buy,cookie,400);assert.equal((await req('state')).session.block_hash,state.session.block_hash);purchases++;}
  if(state.game.level===2){await action({type:'buy',item:'time-cell'});purchases++;}
  if(state.game.lens<3&&state.game.coins>=30*(state.game.lens+1)){await action({type:'buy',item:'lens'});purchases++;}
  await action({type:'next'});
  if(state.game.stock[1])await action({type:'ticks',inputs:[4,0]});if(state.game.stock[2])await action({type:'ticks',inputs:[8,0]});
 }else throw Error('Campaign lost in sector '+state.game.level);
}
assert.equal(state.game.level,20);assert.ok(purchases>=5);assert.equal(state.game.coins,state.game.earned-state.game.spent);assert.equal(state.session.ckb_settled,false);assert.equal((await req('state',undefined,second)).game.tick,0);
await req('action',{session_id:initial.session.id,expected_block:initial.session.block_hash,action:{type:'ticks',inputs:[1]}},cookie,400);
const replay=await req('replay',{});assert.equal(replay.verified,true);const evidence=await req('export'),dir=mkdtempSync(path.join(tmpdir(),'miner-evidence-')),file=path.join(dir,'session.json');writeFileSync(file,JSON.stringify(evidence));const verification=spawnSync(bin,['verify',file],{encoding:'utf8'});assert.equal(verification.status,0,verification.stderr);assert.equal(JSON.parse(verification.stdout).state_root,state.session.state_root);console.log(JSON.stringify({url:base,sectors:20,frames:replay.frames,purchases,coins:state.game.coins,offlineVerified:true,evidence:file}));
