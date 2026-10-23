// Exercise all twelve islands plus item inventory against the real signed runtime.
// STORE_URL=... SKYWARD_BIN=... SMOKE_AUTH=wallet node tests/live-skyward.mjs
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const base=process.env.STORE_URL||'http://127.0.0.1:19092';
let cookie='';
async function req(path,body){
 const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
 const set=r.headers.getSetCookie();if(set.length)cookie=set.map(s=>s.split(';')[0]).join('; ');
 return {status:r.status,data:await r.json()};
}
if(process.env.SMOKE_AUTH==='wallet'){
 const [{ccc},{randomBytes}]=await Promise.all([import('@ckb-ccc/shell'),import('node:crypto')]);
 const owner=ccc.ClientPublicMainnet.open();
 try{
  const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+randomBytes(32).toString('hex')),address=await signer.getRecommendedAddress();
  const challenge=await req('/api/auth/challenge',{address});assert.equal(challenge.status,200);
  assert.equal((await req('/api/auth/verify',{id:challenge.data.id,proof:await signer.signMessage(challenge.data.message)})).status,200);
 }finally{await owner.dispose();}
}else assert.equal((await req('/api/guest',{})).status,200);
const route='/games/sling/api';
let state=(await req(route+'/state')).data;
assert.equal(state.game.total_levels,12);assert.deepEqual(state.game.inventory,{burst:1,pierce:1,extra:1});
async function action(a,ok=true){
 const before=state,payload={action:a,session_id:state.session.id,expected_block:state.session.block_hash};
 const r=await req(route+'/action',payload);assert.equal(r.status,ok?200:400,JSON.stringify(r.data));
 if(ok)state=r.data;else assert.equal((await req(route+'/state')).data.session.block_hash,before.session.block_hash);
 return payload;
}
const solutions=JSON.parse(readFileSync(new URL('./skyward-solutions.json',import.meta.url)));
for(let level=1;level<=12;level++){
 assert.equal(state.game.level,level);
 for(const [dx,dy] of solutions[level]){
  const payload=await action({type:'launch',dx,dy});
  if(level===1)assert.equal((await req(route+'/action',payload)).status,400);
 }
 assert.equal(state.game.won,true,`island ${level}`);
 assert.deepEqual(state.game.inventory,{burst:1,pierce:1,extra:1});
 console.log(`island ${level}: cleared in ${4-state.game.shots} flights without items`);
 if(level<12)await action({type:'next'});
}
await action({type:'next'},false);await action({type:'extra'},false);
async function verify(label){
 const replay=await req(route+'/replay',{});assert.equal(replay.status,200);assert.equal(replay.data.verified,true);
 const exported=(await req(route+'/export')).data;
 const out=resolve('artifacts/skyward');mkdirSync(out,{recursive:true});const file=out+'/'+label+'-export.json';writeFileSync(file,JSON.stringify(exported));
 if(process.env.SKYWARD_BIN){const checked=JSON.parse(execFileSync(process.env.SKYWARD_BIN,['verify',file],{encoding:'utf8'}));assert.equal(checked.verified,true);}
 console.log(`${label}: signed replay and exported evidence verified (${exported.blocks.length} actions)`);
}
await verify('campaign');
state=(await req(route+'/new',{})).data;
await action({type:'extra'});assert.equal(state.game.shots,5);
await action({type:'extra'},false);
for(const power of ['burst','pierce']){
 await action({type:'launch',dx:-8,dy:0,power});assert.equal(state.game.inventory[power],0);
 await action({type:'launch',dx:-8,dy:0,power},false);
}
await action({type:'launch',dx:-80,dy:20,power:'forged'},false);
await verify('items');
console.log('Skyward: twelve-island progression, final boundary, stale rejection, inventory limits, signed replay and export PASS');
