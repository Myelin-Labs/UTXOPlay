import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/shell';
import WebSocket from 'ws';
const base=process.env.STORE_URL||'http://127.0.0.1:8790',owner=ccc.ClientPublicMainnet.open();let peers=[];
async function req(url,body,cookie=''){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
async function login(){const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+randomBytes(32).toString('hex')),address=await signer.getRecommendedAddress();const c=await req('/api/auth/challenge',{address});assert.equal(c.status,200);const v=await req('/api/auth/verify',{id:c.data.id,proof:await signer.signMessage(c.data.message)},c.cookie);assert.equal(v.status,200);return v.cookie;}
try{
 const a=await login(),b=await login(),outsider=await login();
 assert.equal((await req('/games/openstrike/api/state')).status,401);
 const created=await req('/games/openstrike/api/action',{type:'create',mode:'duel'},a);assert.equal(created.status,200,JSON.stringify(created.data));const id=created.data.room.id;
 assert.equal((await req('/games/openstrike/api/export',undefined,outsider)).status,409);
 assert.equal((await req('/games/openstrike/api/action',{type:'join',room:id},b)).status,200);
 assert.equal((await req('/games/openstrike/api/action',{type:'join',room:id},outsider)).status,400);
 assert.equal((await req('/games/openstrike/api/action',{type:'input',room:id,input:{sequence:1,move_x:999}},a)).status,400);
 let count=0,result;
 await new Promise((resolve,reject)=>{
  const ws=new WebSocket(base.replace(/^http/,'ws')+'/games/openstrike/api/socket',{headers:{Origin:base,Cookie:a}});peers.push(ws);let seq=0,done=false;
  const timer=setTimeout(()=>{clearInterval(inputs);reject(Error('Round timeout'));},15000);
  const inputs=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'input',room:id,input:{sequence:++seq,client_tick:seq,move_x:0,move_y:0,yaw:0,pitch:0,walk:false,jump:false,fire:seq>64,reload:false}}));},20);
  ws.on('error',reject);ws.on('message',raw=>{const v=JSON.parse(raw);if(v.type!=='state')return;count++;if(v.room?.status==='failed'){clearTimeout(timer);clearInterval(inputs);reject(Error(v.room.error));}if(v.room?.status==='finished'&&!done){done=true;result=v.room;clearTimeout(timer);clearInterval(inputs);resolve();}});
 });
 assert.equal(result.proof.verified,true);assert.equal(result.state.phase.Ended.winner,'A');assert.ok(count>5);
 const exported=await req('/games/openstrike/api/export',undefined,a);assert.equal(exported.status,200);assert.equal(exported.data.application,'myelin-openstrike');const filepath=process.env.EXPORT_PATH||'/tmp/utxoplay-openstrike-export.json';writeFileSync(filepath,JSON.stringify(exported.data));
 const second=await req('/games/openstrike/api/export',undefined,b);assert.deepEqual(second.data,exported.data);
 assert.equal((await req('/games/openstrike/api/state',undefined,outsider)).data.room,null);
 await req('/api/auth/logout',{},a);assert.equal((await req('/games/openstrike/api/state',undefined,a)).status,401);
 console.log('PASS: CKB login, two-account duel, authenticated WebSocket controls, kill, Myelin verified export, isolation, invalid controls, outsider join/export rejection and logout. Updates:',count,'Export:',filepath);
}finally{for(const ws of peers)ws.terminate();await owner.dispose();}
