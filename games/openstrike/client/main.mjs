import * as THREE from 'three';
import {makeScene} from './scene.mjs';
import {constrain,velocity} from './motion.mjs';
import {startRenderLoop,setText} from '../../../shared/game-performance.mjs';
import {createAudio} from './audio.mjs';
import {settings,roomCode,validRoomCode,roundResult,canRematch,backoff,neutralInput} from './model.mjs';
const $=id=>document.getElementById(id),canvas=$('arena'),api='/games/openstrike/api',loader=globalThis.UTXOPlayLoader;
let preferences;try{const stored=JSON.parse(localStorage.getItem('openstrike:settings')||'{}');preferences=settings({...stored,touch:stored.touch??matchMedia('(pointer:coarse)').matches});}catch{preferences=settings({touch:matchMedia('(pointer:coarse)').matches});}
const reduced=()=>!preferences.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio=createAudio(()=>preferences),keys=new Set();
let room=null,socket=null,sequence=0,yaw=0,pitch=0,active=false,busy=false,disposed=false,retry=0,retryTimer,lastPacket=0,lastSend=0;
let initialized=false,lastRoom=null,lastTick=-1,lastAmmo=null,lastHealth=100,latestAt=0,rtt=30,hitAt=-10000,damageAt=-10000,recoil=0,flashUntil=0,stepAt=0,finishedRoom=null;
let tapUntil=0,reloadUntil=0,fire=false,reload=false,touchFire=false,touchMove={x:0,y:0},shots=0,hits=0,dealt=0,lastReload=false;
let world,stopRender,inputTimer,pingTimer;
const local=new THREE.Vector3(),enemyPosition=new THREE.Vector3(),target=new THREE.Vector3(),remote=new THREE.Vector3(),eye=new THREE.Vector3(0,28,0),movement={};
function status(text,isError=false){setText('status',text);$('status').classList.toggle('error',isError);}
function connection(text,state){setText('connection',text);$('connection').dataset.state=state;}
function clearControls(){keys.clear();tapUntil=reloadUntil=0;fire=touchFire=reload=false;touchMove={x:0,y:0};$('move-knob').style.transform='translate(0,0)';}
function controls(advance=true){const input=neutralInput(advance?++sequence:sequence,room?.tick||0,yaw,pitch);if(active){input.move_x=Math.max(-1,Math.min(1,(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x));input.move_y=Math.max(-1,Math.min(1,(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y));input.walk=keys.has('ShiftLeft')||keys.has('ShiftRight');input.fire=fire||touchFire||performance.now()<tapUntil;input.reload=reload||performance.now()<reloadUntil;}return input;}
function send(force=false){if((document.hidden&&!force)||room?.status!=='running'||socket?.readyState!==WebSocket.OPEN)return;if(!force&&performance.now()-lastSend<12)return;if(socket.bufferedAmount>4096){socket.close();return;}lastSend=performance.now();socket.send(JSON.stringify({type:'input',room:room.id,input:controls()}));reload=false;}
function menu(){active=false;clearControls();if(document.pointerLockElement)document.exitPointerLock?.();$('panel').hidden=false;document.documentElement.dataset.playing='false';send(true);}
async function enter(){if(room?.status!=='running'||socket?.readyState!==WebSocket.OPEN){status('Waiting for the arena connection…',true);return;}audio.ready();active=true;$('panel').hidden=true;document.documentElement.dataset.playing='true';document.dispatchEvent(new Event('utxoplay:fps-menu'));canvas.focus();if(!preferences.touch){try{await canvas.requestPointerLock();}catch{setText('play-hint','Mouse capture unavailable · hold and drag to aim');}}}
function setBusy(value){busy=value;for(const id of ['practice','create','join','again','leave'])$(id).disabled=value;document.documentElement.dataset.requestBusy=String(value);}
async function call(type,extra={}){if(busy)return null;setBusy(true);try{const response=await fetch(api+'/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type,...extra}),signal:AbortSignal.timeout(12000)});const value=await response.json();if(!response.ok)throw Error(value.error||'The arena could not complete that request.');accept(value);return value;}catch(e){status(e.name==='TimeoutError'?'That request took too long. Reconnect and try again.':e.message,true);return null;}finally{setBusy(false);}}
function accept(value){
 if(!('room'in value))return;const next=value.room;
 // HTTP replies can arrive after newer socket frames; never roll the simulation back.
 if(next&&room?.id===next.id&&next.tick<room.tick)return;
 room=next;$('lobby').hidden=!!room;$('roomtools').hidden=!room;$('hud').hidden=!room||!['running','sealing','finished'].includes(room.status);$('touch').hidden=!room||room.status!=='running'||!preferences.touch;
 if(!room){initialized=false;lastRoom=null;menu();$('round-result').hidden=true;status('Choose your training partner. Or invite a friend.');setText('menu-title','A little sunshine.\nA clean shot.');return;}
 setText('roomlabel',room.mode==='practice'?`${room.difficulty||'standard'} training · you vs robot`:'Private duel · '+room.id);$('copy').hidden=room.mode!=='duel';$('resume').hidden=room.status!=='running';$('download').hidden=room.status!=='finished'||!room.proof?.verified;$('again').hidden=!canRematch(room);setText('again',room.mode==='practice'?'Play another round ↗':'Create rematch room ↗');
 if(room.id!==lastRoom){lastRoom=room.id;initialized=false;sequence=0;lastTick=-1;lastAmmo=null;lastHealth=100;shots=hits=dealt=0;lastReload=false;finishedRoom=null;yaw=room.slot?Math.PI:0;pitch=0;clearControls();$('round-result').hidden=true;}
 if(room.state&&room.tick!==lastTick){
  latestAt=performance.now();lastTick=room.tick;const me=room.state.players[room.slot],other=room.state.players[1-room.slot];sequence=Math.max(sequence,me.last_input_sequence||0);
  if(!initialized){local.fromArray(me.position);enemyPosition.fromArray(other.position);initialized=true;}
  if(lastAmmo!==null&&me.ammo<lastAmmo){shots+=lastAmmo-me.ammo;recoil=1;flashUntil=latestAt+45;audio.shot();world?.shoot(latestAt,local.clone().add(eye),{yaw,pitch});}
  if(me.health<lastHealth){damageAt=latestAt;audio.damage();}
  if(me.reloading){reloadUntil=0;if(!lastReload)audio.reload();}lastReload=!!me.reloading;lastAmmo=me.ammo;lastHealth=me.health;
  for(const event of room.events||[])if(event.Damage&&event.Damage.attacker===(room.slot?'B':'A')){hitAt=latestAt;hits++;dealt+=event.Damage.amount;audio.hit();setText('feed','HIT  +'+event.Damage.amount);}
  setText('health',me.health);$('healthbar').value=me.health;document.documentElement.dataset.lowHealth=String(me.health<=30);
  setText('ammo',me.ammo);setText('reserve','/ '+me.reserve);setText('weapon',me.reloading?'RELOADING':'COASTLINE / RIFLE');setText('reloadhint',me.reloading?'CHANGING MAGAZINE':me.ammo===0?'RELOAD · R':me.ammo<=8?'LOW AMMO · R TO RELOAD':'R TO RELOAD');$('ammo-card').classList.toggle('empty',me.ammo<=8);
  const seconds=Math.max(0,Math.ceil((room.maxTicks-room.tick)/64));setText('clock',Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));$('clock').classList.toggle('urgent',seconds<=15);
  if(world)world.enemy.visible=other.alive;
 }
 if(room.status==='waiting'){menu();setText('menu-title','Save a spot.\nShare the code.');status('Waiting for your friend. The round starts when they join.');}
 if(room.status==='running'){setText('menu-title','Back to the\nsunshine.');status('Round live. First elimination wins. The match continues while this menu is open.');}
 if(['sealing','finished'].includes(room.status)){
  if(active)menu();$('panel').hidden=false;$('round-result').hidden=false;setText('result-title',roundResult(room));setText('menu-title','One more\nclean shot?');
  const stats=room.stats?.[room.slot];setText('result-detail',stats?`${stats.shots} shots · ${stats.hits} hits · ${stats.damage} damage`:'Statistics unavailable for this round.');
  setText('replay-state',room.status==='sealing'?'Checking match replay…':room.proof?.verified?'Native replay verified':'Replay verification unavailable');
  status(room.status==='sealing'?'Saving and verifying your match…':'Ready for another round.');
  if(finishedRoom!==room.id){finishedRoom=room.id;if(roundResult(room)==='ROUND WON')audio.win();}
 }
 if(['failed','interrupted','expired','cancelled'].includes(room.status)){menu();status(room.error||'This room has ended. Start another round.',true);}
}
function connect(){
 if(disposed)return;clearTimeout(retryTimer);const ws=new WebSocket(location.origin.replace(/^http/,'ws')+api+'/socket');socket=ws;connection(retry?'Reconnecting':'Connecting','waiting');
 ws.onopen=()=>{if(ws!==socket)return;retry=0;lastPacket=performance.now();connection('LIVE · 64 HZ','live');};
 ws.onmessage=event=>{if(ws!==socket)return;lastPacket=performance.now();try{const message=JSON.parse(event.data);if(message.type==='state')accept(message);else if(message.type==='pong'){rtt=Math.min(500,performance.now()-message.time);connection(Math.round(rtt)+' MS · 64 HZ',rtt>180?'slow':'live');}else if(message.type==='error')status(message.error,true);}catch{status('An arena update could not be read. Reconnecting…',true);ws.close();}};
 ws.onclose=()=>{if(disposed||ws!==socket)return;connection('Reconnecting','waiting');menu();retryTimer=setTimeout(connect,backoff(retry++));};ws.onerror=()=>{};
}
function saveSettings(){for(const id of ['sensitivity','fov','volume'])preferences[id]=Number($(id).value);for(const id of ['sound','motion','touch-controls'])preferences[id==='touch-controls'?'touch':id]=$(id).checked;preferences=settings(preferences);try{localStorage.setItem('openstrike:settings',JSON.stringify(preferences));}catch{}setText('fov-value',preferences.fov+'°');setText('sensitivity-value',preferences.sensitivity.toFixed(1));world?.resize(preferences.fov);$('touch').hidden=!room||room.status!=='running'||!preferences.touch;}
for(const id of ['sensitivity','fov','volume','sound','motion','touch-controls']){const value=preferences[id==='touch-controls'?'touch':id];if(typeof value==='boolean')$(id).checked=value;else $(id).value=value;$(id).addEventListener('input',saveSettings);}saveSettings();
$('practice').onclick=async()=>{audio.ready();if(await call('create',{mode:'practice',difficulty:$('difficulty').value}))await enter();};
$('create').onclick=()=>call('create',{mode:'duel'});
$('join').onclick=async()=>{const code=roomCode($('roomcode').value);if(!validRoomCode(code)){status('Enter the 24-character room code shared by your friend.',true);$('roomcode').focus();return;}if(await call('join',{room:code}))await enter();};
$('roomcode').addEventListener('keydown',e=>{if(e.key==='Enter')$('join').click();});
$('resume').onclick=enter;$('menu').onclick=menu;$('leave').onclick=()=>{menu();call('leave');};
$('again').onclick=async()=>{const mode=room.mode,difficulty=room.difficulty||'standard';if(await call('create',{mode,...(mode==='practice'?{difficulty}:{})})){if(mode==='practice')await enter();}};
$('copy').onclick=()=>navigator.clipboard.writeText(room.id).then(()=>status('Room code copied. Send it to your friend.')).catch(()=>status('Copy this room code: '+room.id));
$('download').onclick=async()=>{try{const response=await fetch(api+'/export',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('The verified replay is not ready yet.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='openstrike-'+room.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){status(e.message,true);}};
addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,button')||e.repeat)return;if(e.code==='Escape'){menu();return;}if(active&&['KeyW','KeyA','KeyS','KeyD','KeyR','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='KeyR'){reload=true;reloadUntil=performance.now()+180;}send();}});
addEventListener('keyup',e=>{keys.delete(e.code);send();});addEventListener('blur',menu);document.addEventListener('visibilitychange',()=>{if(document.hidden)menu();else if(socket?.readyState===WebSocket.OPEN){lastPacket=performance.now();socket.send(JSON.stringify({type:'ping',time:performance.now()}));}});
let captured=false;document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement===canvas)captured=true;else if(captured){captured=false;if(active)menu();}});
canvas.oncontextmenu=e=>e.preventDefault();canvas.onmousedown=e=>{if(!active){enter();return;}if(e.button===0){fire=true;tapUntil=performance.now()+40;send(true);}};addEventListener('mouseup',()=>{fire=false;send();});
function aim(dx,dy,sensitivity){yaw-=dx*sensitivity;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));pitch=Math.max(-1.5,Math.min(1.5,pitch-dy*sensitivity));}
addEventListener('mousemove',e=>{if(active&&(document.pointerLockElement===canvas||(e.buttons===1&&e.target===canvas)))aim(e.movementX,e.movementY,preferences.sensitivity*.002);});
for(const [id,mode]of [['move-pad','move'],['aim-pad','aim']]){
 let origin=null,pointer=null;const el=$(id);
 el.onpointerdown=e=>{if(pointer!==null||!active)return;e.preventDefault();pointer=e.pointerId;origin=[e.clientX,e.clientY];el.setPointerCapture(pointer);};
 el.onpointermove=e=>{if(e.pointerId!==pointer||!origin||!active)return;const dx=e.clientX-origin[0],dy=e.clientY-origin[1];if(mode==='move'){const length=Math.hypot(dx,dy),scale=Math.max(40,length);touchMove={x:dx/scale,y:dy/scale};$('move-knob').style.transform=`translate(${touchMove.x*30}px,${touchMove.y*30}px)`;}else{aim(dx,dy,preferences.sensitivity*.004);origin=[e.clientX,e.clientY];}};
 el.onpointerup=el.onpointercancel=el.onlostpointercapture=e=>{if(e.pointerId!==pointer)return;pointer=null;origin=null;if(mode==='move'){touchMove={x:0,y:0};$('move-knob').style.transform='translate(0,0)';send(true);}};
}
let firePointer=null;$('touch-fire').onpointerdown=e=>{if(!active||firePointer!==null)return;e.preventDefault();firePointer=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);touchFire=true;tapUntil=performance.now()+40;send(true);};
$('touch-fire').onpointerup=$('touch-fire').onpointercancel=$('touch-fire').onlostpointercapture=e=>{if(e.pointerId!==firePointer)return;firePointer=null;touchFire=false;if(e.type!=='pointerup')tapUntil=0;send(true);};$('touch-reload').onclick=()=>{if(active){reload=true;reloadUntil=performance.now()+180;send(true);}};
async function boot(){
 let stage="assets";
 try{
  const response=await fetch('arena.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Arena geometry unavailable');const map=await response.json();
  stage="graphics";loader?.boot();world=await makeScene(canvas,map,(done,total)=>loader?.assets(done,total));loader?.assets(2,2);
  const resize=()=>world.resize(preferences.fov);addEventListener('resize',resize);resize();
  const quality=()=>{let value='auto';try{value=localStorage.getItem('utxoplay:quality')||'auto';}catch{}world.setQuality(value);};quality();addEventListener('utxoplay:quality',quality);addEventListener('storage',quality);
  stopRender=startRenderLoop((now,elapsed)=>{
   const dt=Math.min(elapsed/1000,.04);let moving=0,enemySpeed=0,reloading=false;
   if(initialized&&room?.state){
    const me=room.state.players[room.slot],other=room.state.players[1-room.slot],age=Math.min(.1,(now-latestAt+rtt/2)/1000);
    constrain(target.set(me.position[0]+me.velocity[0]*age,0,me.position[2]+me.velocity[2]*age),map);
    if(room.status==='running'&&me.alive){const v=velocity(controls(false),movement);local.x+=v.x*dt;local.z+=v.z*dt;constrain(local,map);if(local.distanceTo(target)>120)local.copy(target);else local.lerp(target,1-Math.exp(-dt*16));constrain(local,map);moving=Math.min(1,Math.hypot(v.x,v.z)/250);}else local.copy(target);
    world.camera.position.copy(local).add(eye);world.camera.rotation.set(pitch,yaw,0,'YXZ');
    remote.set(other.position[0]+other.velocity[0]*age,0,other.position[2]+other.velocity[2]*age);constrain(remote,map);enemyPosition.lerp(remote,1-Math.exp(-dt*22));world.enemy.position.copy(enemyPosition);world.enemy.rotation.y=other.yaw;
    world.gun.visible=room.status==='running'&&me.alive;enemySpeed=Math.hypot(other.velocity[0],other.velocity[2]);reloading=!!me.reloading;
   }else{const angle=reduced()?.65:now*.000035;world.camera.position.set(Math.sin(angle)*440,245,Math.cos(angle)*440);world.camera.lookAt(0,-5,0);world.gun.visible=false;world.enemy.visible=false;}
   if(active&&moving>.2&&now-stepAt>330){stepAt=now;audio.step();}
   recoil*=Math.exp(-dt*20);world.flash.visible=!reduced()&&now<flashUntil;
   world.animate(now,dt,{moving,recoil,reloading,reduced:reduced(),enemySpeed});
   $('crosshair').style.setProperty('--spread',(recoil*7+moving*2)+'px');$('hit').style.opacity=now-hitAt<180?'1':'0';$('damage').style.opacity=String(Math.max(0,1-(now-damageAt)/450)*.55);if(now-hitAt>1200)setText('feed','');
   world.renderer.render(world.scene,world.camera);document.documentElement.dataset.drawCalls=String(world.renderer.info.render.calls);
  },{active:()=>active&&room?.status==='running',maxFps:120,onResolution:ratio=>world.resolution(ratio)});
  stage='session';const state=await fetch(api+'/state',{signal:AbortSignal.timeout(15000)});if(!state.ok)throw Error('Your game session is unavailable. Return to UTXOPlay and launch the game again.');accept(await state.json());loader?.session();loader?.ready();connect();
  inputTimer=setInterval(()=>send(),1000/64);pingTimer=setInterval(()=>{if(socket?.readyState===WebSocket.OPEN){if(!document.hidden&&performance.now()-lastPacket>9000){socket.close();return;}socket.send(JSON.stringify({type:'ping',time:performance.now()}));}},2000);
 }catch(e){$('fatal').hidden=false;$('fatal').textContent=e.message;loader?.fail(e.stage||stage);console.error(e);}
}
addEventListener('pagehide',()=>{disposed=true;clearTimeout(retryTimer);clearInterval(inputTimer);clearInterval(pingTimer);socket?.close();stopRender?.();audio.dispose();world?.dispose();});
await boot();
