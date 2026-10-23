// End-to-end WebSocket path: store cookie -> private runtime -> real engine.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createApp} from '../server/index.mjs';
const dir=mkdtempSync(path.join(tmpdir(),'utxoplay-realtime-'));
const game=process.env.TEEWORLDS_DIR||path.resolve('../myelin-teeworlds');
const origin='http://127.0.0.1:18984';
process.env.RUNTIME_TOKEN='disposable-realtime-integration-token';process.env.TEEWORLDS_URL='http://127.0.0.1:18985';
let child,service,server;const sockets=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function request(endpoint,body,cookie=''){const r=await fetch(origin+endpoint,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json(),cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
async function rejected(cookie,extra={},endpoint='/games/teeworlds/api/socket'){
 return new Promise((resolve,reject)=>{const ws=new WebSocket(origin.replace('http','ws')+endpoint,{headers:{Origin:origin,Cookie:cookie,...extra}});ws.on('unexpected-response',(_req,res)=>{resolve(res.statusCode);res.resume();ws.terminate();});ws.on('open',()=>{ws.terminate();reject(Error('Unexpectedly accepted'));});ws.on('error',()=>{});});
}
function connect(cookie,extra={}){const ws=new WebSocket(origin.replace('http','ws')+'/games/teeworlds/api/socket',{headers:{Origin:origin,Cookie:cookie,...extra}});sockets.push(ws);ws.messages=[];ws.on('message',raw=>ws.messages.push({...JSON.parse(raw),received:performance.now()}));ws.on('error',()=>{});return ws;}
async function wait(ws,predicate,timeout=4000){const end=Date.now()+timeout;while(Date.now()<end){const found=ws.messages.find(predicate);if(found)return found;await delay(5);}throw Error('Timed out waiting for realtime message');}
try{
 child=spawn(process.execPath,['service/server.mjs'],{cwd:game,env:{...process.env,DATA_DIR:path.join(dir,'runtime'),PORT:'18985',MATCH_TICKS:'250'},stdio:['ignore','pipe','pipe']});child.stderr.on('data',b=>process.stderr.write(b));await once(child.stdout,'data');
 service=createApp({dataDir:path.join(dir,'store'),origin});server=service.app.listen(18984,'127.0.0.1');service.attachSockets(server);await once(server,'listening');
 const a=await request('/api/guest',{}),b=await request('/api/guest',{});
 assert.equal(await rejected(''),401);assert.equal(await rejected(a.cookie,{Origin:'https://evil.invalid'}),403);assert.equal(await rejected(a.cookie,{},'/games/chess/api/socket'),404);
 const wa=connect(a.cookie,{'X-UTXOPlay-Account':b.body.user.id});await wait(wa,m=>m.type==='ready');
 const wb=connect(b.cookie);await wait(wb,m=>m.type==='ready');
 const created=await request('/games/teeworlds/api/action',{type:'create',mode:'duel'},a.cookie);assert.equal(created.status,200);const room=created.body.room.id;
 await request('/games/teeworlds/api/action',{type:'join',room},b.cookie);
 const initial=await wait(wa,m=>m.room?.state?.items.some(i=>i[0]===10));assert.equal(initial.room.slot,0);
 assert.equal((await wait(wb,m=>m.room?.status==='running')).room.slot,1);
 const controls={direction:1,x:300,y:-100,jump:1,fire:1,hook:0,weapon:2,seq:100};
 const start=performance.now();wa.send(JSON.stringify({type:'input',room,input:controls}));
 const applied=await wait(wa,m=>m.room?.appliedSeq===100);
 const latency=applied.received-start;assert.ok(latency<200,`Local input-to-snapshot latency ${latency}ms`);
 assert.equal(applied.room.state.items.find(i=>i[0]===10&&i[1]===0)[2][6],1,'Real character accepted direction');
 wa.send(JSON.stringify({type:'input',room,input:{...controls,direction:-1,seq:99}}));
 await delay(150);assert.equal(wa.messages.at(-1).room.appliedSeq,100,'Old sequences cannot overwrite newer input');
 wa.send(JSON.stringify({type:'input',room,input:{...controls,x:999999,seq:101}}));await wait(wa,m=>m.type==='error'&&m.error==='Invalid controls');
 const frames=wa.messages.filter(m=>m.room?.state?.tick>0);assert.ok(frames.length>=4);
 const intervals=frames.slice(1).map((m,i)=>m.received-frames[i].received).filter(n=>n>5);assert.ok(intervals.every(n=>n<120));
 const gone=once(wb,'close');await request('/api/auth/logout',{},b.cookie);wb.send(JSON.stringify({type:'ping',time:1}));await gone;
 assert.equal(await rejected(b.cookie),401);
 wa.close();await once(wa,'close');const resumed=connect(a.cookie);assert.equal((await wait(resumed,m=>m.room?.id===room)).room.slot,0);
 const finished=await wait(resumed,m=>m.room?.status==='finished',15000);assert.equal(finished.room.proof.verified,true);
 console.log(JSON.stringify({pass:true,inputToAuthoritativeSnapshotMs:Math.round(latency),meanSnapshotIntervalMs:Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length),checks:['cookie authentication','origin rejection','account spoof rejected','real engine controls','input ordering and bounds','logout revocation','socket reconnect','Myelin replay seal']}));
}finally{
 for(const ws of sockets)ws.terminate();await delay(20);if(service)service.close();if(server)await new Promise(r=>server.close(r));if(child){const done=once(child,'exit');child.kill();await done;}rmSync(dir,{recursive:true,force:true});
}
