// Exercise both real games through the deployed store. Uses isolated disposable guests.
import assert from 'node:assert/strict';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
async function req(route,body,cookie='') {const response=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();return{status:response.status,data,cookie:response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
const a=await req('/api/guest',{}),b=await req('/api/guest',{});assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.data.user.id,b.data.user.id);
for (const name of ['chess','sling']) {
 const route='/games/'+name+'/api';const initial=await req(route+'/state',undefined,a.cookie);assert.equal(initial.status,200,JSON.stringify(initial.data));const separate=await req(route+'/state',undefined,b.cookie);assert.notEqual(initial.data.session.id,separate.data.session.id);
 const action=name==='chess'?{type:'move',uci:'e2e4'}:{type:'launch',dx:-90,dy:45};
 const payload={session_id:initial.data.session.id,expected_block:initial.data.session.block_hash,action};
 const moved=await req(route+'/action',payload,a.cookie);assert.equal(moved.status,200,JSON.stringify(moved.data));assert.equal(moved.data.session.actions,1);
 assert.equal((await req(route+'/action',payload,a.cookie)).status,400);
 const untouched=await req(route+'/state',undefined,b.cookie);assert.equal(untouched.data.session.actions,0);
 const replay=await req(route+'/replay',{},a.cookie);assert.equal(replay.data.verified,true);
 const exportData=await req(route+'/export',undefined,a.cookie);assert.equal(exportData.data.blocks.length,1);
 const restored=await req(route+'/state',undefined,a.cookie);assert.equal(restored.data.session.block_hash,moved.data.session.block_hash);
 console.log(name+': isolated state, legal action, stale rejection, replay and evidence export PASS');
}
assert.equal((await req('/api/library',undefined,a.cookie)).data.games.length,2);
console.log('Store gameplay smoke PASS');
