// Real native Myelin runtime, two browser identities, Store/native restart and offline verification.
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createApp} from '../server/index.mjs';
const binary=process.env.CHESS_BINARY||'/tmp/utxoplay-chess-native',dir=mkdtempSync('/tmp/chess-online-flow-');
process.env.RUNTIME_TOKEN=randomBytes(32).toString('hex');process.env.CHESS_URL='http://127.0.0.1:18197';
const origin='http://127.0.0.1:19127';let native,service,server;
async function start(){
 native=spawn(binary,[],{env:{...process.env,DATA_DIR:dir+'/native',PORT:'18197',BIND:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{native.stdout.once('data',resolve);native.once('exit',code=>reject(Error('Native exited '+code)));});
 service=createApp({dataDir:dir+'/store',origin,marketplaceOptions:{startWorker:false}});server=service.app.listen(19127,'127.0.0.1');await new Promise(r=>server.once('listening',r));
}
async function stop(){service?.close();if(server)await new Promise(r=>server.close(r));if(native){const done=new Promise(r=>native.once('exit',r));native.kill();await done;}}
async function req(path,body,cookie=''){
 const r=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};
}
try{
 await start();const a=await req('/api/guest',{}),b=await req('/api/guest',{}),c=await req('/api/guest',{});
 const created=await req('/games/chess/api/rooms',{color:'white'},a.cookie);assert.equal(created.status,201);
 const route='/games/chess/api/rooms/'+created.data.room.id;
 assert.equal((await req(route+'/join',{},b.cookie)).status,200);assert.equal((await req(route+'/join',{},c.cookie)).status,409);
 let state=(await req(route+'/state',undefined,a.cookie)).data;
 const original=structuredClone(state);
 for(const [i,move] of ['f2f3','e7e5'].entries()){
  const r=await req(route+'/action',{action:{type:'move',uci:move},session_id:state.session.id,expected_block:state.session.block_hash},i%2?b.cookie:a.cookie);assert.equal(r.status,200,JSON.stringify(r));state=r.data;
 }
 assert.equal((await req(route+'/action',{action:{type:'move',uci:'g2g4'},session_id:original.session.id,expected_block:original.session.block_hash},a.cookie)).status,409);
 const head=state.session.block_hash;
 await stop();await start();
 state=(await req(route+'/state',undefined,b.cookie)).data;assert.equal(state.session.block_hash,head);assert.equal(state.room.color,'black');assert.equal(state.game.moves.length,2);
 for(const [i,move] of ['g2g4','d8h4'].entries()){
  const r=await req(route+'/action',{action:{type:'move',uci:move},session_id:state.session.id,expected_block:state.session.block_hash},i%2?b.cookie:a.cookie);assert.equal(r.status,200,JSON.stringify(r));state=r.data;
 }
 assert.match(state.game.result,/BlackCheckmates/);
 const replay=(await req(route+'/replay',{},a.cookie)).data;assert.equal(replay.verified,true);assert.equal(replay.positions.length,5);
 const exported=(await req(route+'/export',undefined,b.cookie)).data;writeFileSync(dir+'/evidence.json',JSON.stringify(exported));
 const verified=JSON.parse(execFileSync(binary,['verify',dir+'/evidence.json'],{encoding:'utf8'}));assert.equal(verified.verified,true);assert.equal(verified.frames,4);
 assert.equal(verified.state_root,state.session.state_root);
 assert.equal((await req('/games/chess/api/state',undefined,a.cookie)).data.game.moves.length,0);
 console.log(JSON.stringify({onlinePlies:4,result:state.game.result,storeAndNativeRestart:'preserved seats and head',offlineReplay:verified.verified,personalGame:'isolated'}));
}finally{await stop();rmSync(dir,{recursive:true,force:true});}
