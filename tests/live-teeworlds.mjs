import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
async function req(route,body,cookie='',extra={}){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie,...extra},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
const guests=[];for(let i=0;i<3;i++){const g=await req('/api/guest',{});assert.equal(g.status,200,JSON.stringify(g.data));guests.push(g);}
const [a,b,c]=guests,route='/games/teeworlds/api';
const created=await req(route+'/action',{type:'create',mode:'duel'},a.cookie);assert.equal(created.status,200,JSON.stringify(created.data));const room=created.data.room.id;
const joined=await req(route+'/action',{type:'join',room},b.cookie);assert.equal(joined.status,200);assert.equal(joined.data.room.slot,1);assert.equal((await req(route+'/state',undefined,a.cookie,{'X-UTXOPlay-Account':b.data.user.id})).data.room.slot,0);
assert.equal((await req(route+'/action',{type:'join',room},c.cookie)).status,400);assert.equal((await req(route+'/export',undefined,c.cookie)).status,409);
console.log('Public room joined by two isolated accounts; outsider rejected.');
let finished;const start=Date.now();let milestone=0;
while(Date.now()-start<100000){
 const t=Date.now()-start;
 if(t<8000){for(const [slot,guest]of [a,b].entries()){
 const input={direction:slot?1:-1,x:slot?-300:300,y:-100,jump:Math.floor(t/500)%2,fire:(Math.floor(t/200)%32)*2+1,hook:Math.floor(t/700)%2,weapon:2,seq:Date.now()};
 assert.equal((await req(route+'/action',{type:'input',room,input},guest.cookie)).status,200);
 }}
 const state=(await req(route+'/state',undefined,a.cookie)).data.room;
 if(state.status==='failed')throw Error(state.error);
 if(state.status==='finished'){finished=state;break;}
 if(t>milestone){console.log('Live round:',state.tick,'ticks,',state.status);milestone+=20000;}
 await new Promise(r=>setTimeout(r,t<8000?150:1000));
}
assert.ok(finished,'Round did not seal within timeout');assert.equal(finished.tick,3000);assert.equal(finished.proof.verified,true);assert.equal(finished.proof.actions,1);
const exported=await req(route+'/export',undefined,a.cookie),shared=await req(route+'/export',undefined,b.cookie);assert.equal(exported.status,200);assert.deepEqual(exported.data,shared.data);
assert.ok((await req('/api/library',undefined,a.cookie)).data.games.some(g=>g.game==='teeworlds'));
if(process.env.EXPORT_PATH)writeFileSync(process.env.EXPORT_PATH,JSON.stringify(exported.data));
console.log('PASS: public 60-second duel, controls, membership, Myelin sealing, shared export and library. State root:',finished.proof.state_root);
