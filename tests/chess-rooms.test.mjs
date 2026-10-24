import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/index.mjs';
const dir=mkdtempSync(join(tmpdir(),'chess-rooms-')),origin='http://localhost';
const calls=[],states=new Map();
const service=createApp({dataDir:dir,origin,marketplaceOptions:{startWorker:false},runtimeFetch:async(url,options)=>{
 const id=options.headers['X-UTXOPlay-Account'];calls.push({url,id});
 let s=states.get(id)||{game:{turn:'white',moves:[],result:null},session:{id,block_hash:'head-0',height:0}};
 if(url.endsWith('/action')){const b=JSON.parse(options.body);if(b.expected_block!==s.session.block_hash)return Response.json({error:'stale head'},{status:400});if(b.action.uci==='e2e5')return Response.json({error:'That move is not legal'},{status:400});s={game:{...s.game,turn:s.game.turn==='white'?'black':'white',moves:[...s.game.moves,b.action.uci]},session:{...s.session,height:s.session.height+1,block_hash:'head-'+(s.session.height+1)}};}
 states.set(id,s);return Response.json(url.endsWith('/replay')?{verified:true}:s);
}});
const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
after(async()=>{service.close();await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
async function req(path,body,cookie='',headers={}){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};}
const route='/games/chess/api/rooms';
test('private tables enforce fixed authenticated seats, legal turns, native head checks and durable membership',async()=>{
 const white=await req('/api/guest',{}),black=await req('/api/guest',{}),other=await req('/api/guest',{});
 assert.equal((await req(route,{color:'white'})).status,401);
 assert.equal((await req(route,{color:'white'},white.cookie,{Origin:'https://invalid.test'})).status,403);
 const created=await req(route,{color:'white'},white.cookie);assert.equal(created.status,201);const id=created.data.room.id;
 const action=(state,uci)=>({action:{type:'move',uci},session_id:state.session.id,expected_block:state.session.block_hash});
 assert.equal((await req(`${route}/${id}/action`,action(created.data,'e2e4'),white.cookie)).status,409);
 assert.equal((await req(`${route}/${id}/state`,undefined,other.cookie)).status,403);
 assert.equal((await req(`${route}/${id}/export`,undefined,other.cookie)).status,403);
 const joined=await req(`${route}/${id}/join`,{},black.cookie);assert.equal(joined.data.room.color,'black');assert.equal(joined.data.room.ready,true);
 assert.equal((await req(`${route}/${id}/join`,{},white.cookie)).data.room.color,'white');
 assert.equal((await req(`${route}/${id}/join`,{},other.cookie)).status,409);
 assert.equal((await req(`${route}/${id}/action`,action(joined.data,'e7e5'),black.cookie)).status,403);
 assert.equal((await req(`${route}/${id}/action`,action(joined.data,'e2e5'),white.cookie)).status,409);
 const moved=await req(`${route}/${id}/action`,action(joined.data,'e2e4'),white.cookie,{'X-UTXOPlay-Account':black.data.user.id});assert.equal(moved.status,200);
 assert.equal((await req(`${route}/${id}/action`,action(joined.data,'e7e5'),black.cookie)).status,409);
 assert.equal((await req(`${route}/${id}/action`,action(moved.data,'e7e5'),black.cookie)).status,200);
 assert.equal((await req(`${route}/${id}/replay`,{},black.cookie)).data.verified,true);
 assert.equal((await req(route,undefined,black.cookie)).data.rooms[0].id,id);
 const native=calls.filter(c=>c.url.endsWith('/action')).at(-1).id;assert.notEqual(native,white.data.user.id);assert.notEqual(native,black.data.user.id);
 const saved=service.db.prepare('SELECT * FROM chess_rooms WHERE id=?').get(id);assert.equal(saved.white,white.data.user.id);assert.equal(saved.black,black.data.user.id);
 assert.equal((await req('/games/chess/api/state',undefined,white.cookie)).data.game.moves.length,0);
});
test('SSE sends authenticated snapshots without polling the native runtime for each subscriber',async()=>{
 const a=await req('/api/guest',{});const created=await req(route,{color:'black'},a.cookie),id=created.data.room.id;
 const before=calls.length,controller=new AbortController();
 const res=await fetch(`${base}${route}/${id}/events`,{headers:{Cookie:a.cookie},signal:controller.signal});
 assert.equal(res.status,200);assert.match(res.headers.get('content-type'),/text\/event-stream/);
 const reader=res.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);
 assert.match(first,/event: position/);assert.match(first,/"color":"black"/);assert.equal(calls.length,before);
 controller.abort();await reader.cancel().catch(()=>{});
});
