// Native-engine integration: continuously steer a disposable account over the real WebSocket.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {ccc} from '@ckb-ccc/shell';
import {WebSocket} from 'ws';
import {CharacterMotion,constrainCharacter} from '../games/teeworlds/web/motion.mjs';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
const map=JSON.parse(await readFile(new URL('../games/teeworlds/web/assets/map.json',import.meta.url)));
const motion=new CharacterMotion(map.types.character,(...p)=>constrainCharacter(map,...p));
const owner=ccc.ClientPublicMainnet.open();let ws,roomId,cookie,timer;
async function req(url,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{Origin:base,Cookie:cookie||'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));const next=r.headers.getSetCookie();if(next.length)cookie=next.map(s=>s.split(';')[0]).join('; ');return data;}
try{
 const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+randomBytes(32).toString('hex'));
 const c=await req('/api/auth/challenge',{address:await signer.getRecommendedAddress()});await req('/api/auth/verify',{id:c.id,proof:await signer.signMessage(c.message)});
 ws=new WebSocket(base.replace(/^http/,'ws')+'/games/teeworlds/api/socket',{headers:{Origin:base,Cookie:cookie}});
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 let updates=0,moving=0,continuous=0,maxJump=0,lastTick=-1;
 ws.on('message',raw=>{const msg=JSON.parse(raw),s=msg.room?.state;if(!s||s.tick<=lastTick)return;lastTick=s.tick;const now=performance.now(),before=motion.sample(now).find(c=>c[1]===0)?.[2],old=motion.entries.get(0)?.data;motion.push(s,now);const after=motion.sample(now).find(c=>c[1]===0)?.[2],native=motion.entries.get(0)?.data;updates++;if(native&&(Math.abs(native[3])+Math.abs(native[4])>256))moving++;if(before&&after&&old&&native&&Math.hypot(native[1]-old[1],native[2]-old[2])<250){continuous++;maxJump=Math.max(maxJump,Math.hypot(before[1]-after[1],before[2]-after[2]));}});
 roomId=(await req('/games/teeworlds/api/action',{type:'create',mode:'practice'})).room.id;
 let seq=Date.now(),count=0;
 timer=setInterval(()=>{count++;ws.send(JSON.stringify({type:'input',room:roomId,input:{direction:Math.floor(count/40)%2?1:-1,x:200,y:-50,jump:count%35<4?1:0,hook:count%90<15?1:0,fire:0,weapon:2,seq:++seq}}));},20);
 await new Promise(r=>setTimeout(r,6500));clearInterval(timer);timer=null;
 assert.ok(updates>80,{updates});assert.ok(moving>20,{moving});assert.ok(continuous>50,{continuous});assert.ok(maxJump<1e-7,{maxJump});
 console.log(JSON.stringify({pass:true,updates,movingSnapshots:moving,continuousCorrections:continuous,maxCorrectionJumpPx:maxJump}));
 await req('/games/teeworlds/api/action',{type:'leave'});await req('/api/auth/logout',{});
}finally{if(timer)clearInterval(timer);ws?.terminate();await owner.dispose();}
