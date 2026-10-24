import assert from 'node:assert/strict';import WebSocket from 'ws';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
async function req(path,body,cookie=''){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
for(const difficulty of ['rookie','standard','veteran']){
 const guest=await req('/api/guest',{});assert.equal(guest.status,200);
 const created=await req('/games/openstrike/api/action',{type:'create',mode:'practice',difficulty},guest.cookie);assert.equal(created.status,200);assert.equal(created.data.room.difficulty,difficulty);
 const room=created.data.room.id;let firstDamage;
 const result=await new Promise((resolve,reject)=>{const ws=new WebSocket(base.replace('http','ws')+'/games/openstrike/api/socket',{headers:{Origin:base,Cookie:guest.cookie}});let sequence=0,tick=0;
  const input=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({type:'input',room,input:{sequence:++sequence,client_tick:tick,move_x:0,move_y:0,yaw:0,pitch:0,walk:false,jump:false,fire:false,reload:false}}));},25);
  const timeout=setTimeout(()=>finish(Error('Practice did not end')),35000);
  function finish(error,value){clearTimeout(timeout);clearInterval(input);ws.terminate();error?reject(error):resolve(value);}
  ws.on('error',e=>finish(e));ws.on('message',data=>{const event=JSON.parse(data);if(event.type!=='state'||!event.room)return;const r=event.room;tick=r.tick;if(r.state?.players[0].health<100&&firstDamage===undefined)firstDamage=tick;if(r.status==='failed')finish(Error(r.error));if(r.status==='finished')finish(null,r);});
 });
 assert.equal(result.proof.verified,true);assert.ok(result.stats[1].shots>0);assert.ok(result.stats[1].damage>=100);assert.equal(result.stats[0].shots,0);if(difficulty==='rookie')assert.ok(firstDamage>=640);
 const reload=await req('/games/openstrike/api/state',undefined,guest.cookie);assert.deepEqual(reload.data.room.stats,result.stats);
 const next=await req('/games/openstrike/api/action',{type:'create',mode:'practice',difficulty},guest.cookie);assert.equal(next.status,200);assert.notEqual(next.data.room.id,room);
 await req('/games/openstrike/api/action',{type:'leave'},guest.cookie);
 console.log('PASS',difficulty,'real native bot match, replay verification, persisted stats, rematch; first damage tick',firstDamage);
}
