import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/shell';
import {WebSocket} from 'ws';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
const owner=ccc.ClientPublicMainnet.open(),sockets=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(endpoint,body,cookie=''){const r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return{data,cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
async function login(){const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+randomBytes(32).toString('hex'));const address=await signer.getRecommendedAddress();const c=await request('/api/auth/challenge',{address});return request('/api/auth/verify',{id:c.data.id,proof:await signer.signMessage(c.data.message)},c.cookie);}
function connect(cookie){const ws=new WebSocket(base.replace(/^http/,'ws')+'/games/teeworlds/api/socket',{headers:{Origin:base,Cookie:cookie}});sockets.push(ws);ws.messages=[];ws.on('message',raw=>ws.messages.push({...JSON.parse(raw),received:performance.now()}));ws.on('error',e=>console.error('WebSocket:',e.message));return ws;}
async function wait(ws,fn,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){const m=ws.messages.find(fn);if(m)return m;await pause(5);}throw Error('Realtime deadline exceeded');}
try{
 const a=await login(),b=await login(),wa=connect(a.cookie),wb=connect(b.cookie);await Promise.all([wait(wa,m=>m.type==='ready'),wait(wb,m=>m.type==='ready')]);
 const created=await request('/games/teeworlds/api/action',{type:'create',mode:'duel'},a.cookie);const id=created.data.room.id;await request('/games/teeworlds/api/action',{type:'join',room:id},b.cookie);
 await wait(wa,m=>m.room?.state?.items.some(i=>i[0]===10&&i[1]===0));assert.equal((await wait(wb,m=>m.room?.status==='running')).room.slot,1);
 const times=[];
 for(let i=1;i<=8;i++){
  const start=performance.now(),direction=i%2?1:-1;
  wa.send(JSON.stringify({type:'input',room:id,input:{direction,x:direction*300,y:-50,jump:i%2,fire:i,hook:0,weapon:2,seq:i}}));
  const applied=await wait(wa,m=>m.room?.appliedSeq===i);times.push(applied.received-start);
  assert.equal(applied.room.state.items.find(c=>c[0]===10&&c[1]===0)[2][6],direction);
  await pause(100);
 }
 times.sort((a,b)=>a-b);console.log(JSON.stringify({stage:'realtime',samples:times.length,inputToSnapshotMedianMs:Math.round(times[4]),minMs:Math.round(times[0]),maxMs:Math.round(times.at(-1))}));
 let seq=100;const timer=setInterval(()=>{for(const [ws,sign]of [[wa,1],[wb,-1]])if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'input',room:id,input:{direction:Math.floor(seq/20)%2?sign:-sign,x:300*sign,y:-100,jump:seq%25<3?1:0,fire:(Math.floor(seq/3)*2+1)&63,hook:seq%30<5?1:0,weapon:2,seq}}));seq++;},100);
 let final;
 try{final=await wait(wa,m=>m.room?.status==='finished'||m.room?.status==='failed',90000);}finally{clearInterval(timer);}
 assert.equal(final.room.status,'finished',final.room.error);assert.equal(final.room.proof.verified,true);assert.equal(final.room.tick,3000);
 const ea=await request('/games/teeworlds/api/export',undefined,a.cookie),eb=await request('/games/teeworlds/api/export',undefined,b.cookie);assert.deepEqual(ea.data,eb.data);
 writeFileSync('/tmp/utxoplay-public-realtime-export.json',JSON.stringify(ea.data));
 await request('/api/auth/logout',{},a.cookie);await request('/api/auth/logout',{},b.cookie);
 console.log(JSON.stringify({pass:true,ticks:3000,verified:true,stateRoot:final.room.proof.state_root,export:'/tmp/utxoplay-public-realtime-export.json'}));
}finally{for(const ws of sockets)ws.terminate();await owner.dispose();}
