import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ccc} from '@ckb-ccc/shell';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
const owner=ccc.ClientPublicMainnet.open(),sessions=[],dir=mkdtempSync('/tmp/live-chess-online-');
async function req(path,body,cookie=''){
 const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
}
async function login(){
 const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+randomBytes(32).toString('hex'));
 const address=await signer.getRecommendedAddress();const challenge=await req('/api/auth/challenge',{address});assert.equal(challenge.status,200);
 const r=await req('/api/auth/verify',{id:challenge.data.id,proof:await signer.signMessage(challenge.data.message)},challenge.cookie);assert.equal(r.status,200);sessions.push(r.cookie);return r.cookie;
}
try{
 const white=await login(),black=await login();
 const created=await req('/games/chess/api/rooms',{color:'white'},white);assert.equal(created.status,201,JSON.stringify(created.data));
 const route='/games/chess/api/rooms/'+created.data.room.id;
 const joined=await req(route+'/join',{},black);assert.equal(joined.status,200);assert.equal(joined.data.room.color,'black');
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const stream=await fetch(base+route+'/events',{headers:{Cookie:white},signal:controller.signal});assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/text\/event-stream/);
  const reader=stream.body.getReader();let text='';while(!text.includes('event: position'))text+=new TextDecoder().decode((await reader.read()).value);assert.match(text,/"ready":true/);
 }finally{clearTimeout(timeout);controller.abort();}
 let state=joined.data;
 for(const [i,move] of ['f2f3','e7e5','g2g4','d8h4'].entries()){
  const r=await req(route+'/action',{action:{type:'move',uci:move},session_id:state.session.id,expected_block:state.session.block_hash},i%2?black:white);assert.equal(r.status,200,JSON.stringify(r.data));state=r.data;
 }
 assert.match(state.game.result,/BlackCheckmates/);
 assert.equal((await req(route+'/state',undefined,white)).data.session.block_hash,state.session.block_hash);
 const replay=(await req(route+'/replay',{},black)).data;assert.equal(replay.verified,true);assert.equal(replay.positions.length,5);
 const exported=(await req(route+'/export',undefined,white)).data;writeFileSync(dir+'/evidence.json',JSON.stringify(exported));
 let offline=false;if(process.env.CHESS_BINARY){const v=JSON.parse(execFileSync(process.env.CHESS_BINARY,['verify',dir+'/evidence.json'],{encoding:'utf8'}));assert.equal(v.verified,true);assert.equal(v.state_root,state.session.state_root);offline=true;}
 console.log(JSON.stringify({onlinePlies:4,result:state.game.result,sse:'public event received',nativeReplay:replay.verified,offlineReplay:offline,auth:'two disposable CKB signing identities; no funds or transactions'}));
}finally{
 for(const cookie of sessions)await req('/api/auth/logout',{},cookie).catch(()=>{});
 await owner.dispose();rmSync(dir,{recursive:true,force:true});
}
