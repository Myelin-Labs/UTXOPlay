import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createGame,step,kinds} from '../games/arcade/web/engine.mjs';
const base=process.env.STORE_URL||'http://127.0.0.1:8795';
async function req(path,body,cookie=''){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,value:await r.json(),cookie:r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};}
const a=await req('/api/guest',{}),b=await req('/api/guest',{});assert.equal(a.status,200);assert.equal(b.status,200);
for(const kind of kinds){
 const prefix=`/games/${kind}/api/`;const state=await req(prefix+'state',undefined,a.cookie);assert.equal(state.status,200);assert.equal(state.value.game.kind,kind);
 const fresh=createGame(kind);assert.deepEqual(state.value.game,fresh);
 const tape=Array.from({length:30},(_,i)=>kind==='starfall'?16:kind==='neon-coil'?(i<12?4:2):0);
 const body={session_id:state.value.session.id,expected_block:state.value.session.block_hash,action:{type:'ticks',inputs:tape}};
 const result=await req(prefix+'action',body,a.cookie);assert.equal(result.status,200,JSON.stringify(result.value));for(const i of tape)step(fresh,i);assert.deepEqual(result.value.game,fresh);
 assert.equal((await req(prefix+'action',body,a.cookie)).status,400,'stale head rejected');
 const untouched=await req(prefix+'state',undefined,b.cookie);assert.equal(untouched.value.game.tick,0);assert.notEqual(untouched.value.session.id,result.value.session.id);
 const replay=await req(prefix+'replay',{},a.cookie);assert.equal(replay.value.verified,true);assert.equal(replay.value.frames,1);assert.equal(replay.value.state_root,result.value.session.state_root);
 const exported=await req(prefix+'export',undefined,a.cookie);assert.equal(exported.value.game,kind);assert.equal(exported.value.blocks.length,1);
 if(process.env.ARCADE_BIN){const dir=mkdtempSync(join(tmpdir(),'arcade-export-'));try{const file=join(dir,'export.json');writeFileSync(file,JSON.stringify(exported.value));const check=spawnSync(process.env.ARCADE_BIN,['verify',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);assert.equal(JSON.parse(check.stdout).state_root,result.value.session.state_root);}finally{rmSync(dir,{recursive:true,force:true});}}
 const bad={...body,session_id:result.value.session.id,expected_block:result.value.session.block_hash,action:{type:'ticks',inputs:[32]}};assert.equal((await req(prefix+'action',bad,a.cookie)).status,400);assert.equal((await req(prefix+'state',undefined,a.cookie)).value.session.state_root,result.value.session.state_root);
 console.log(`${kind}: real runtime, prediction, isolated accounts, stale-head rejection, malformed-input rejection, signed replay and export passed`);
}
