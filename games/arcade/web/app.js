import {createGame,step,kinds} from './engine.mjs';
import {InputBuffer,feedback} from './presentation.mjs';
import {ArcadeRenderer} from './renderer.mjs';
import {ArcadeAudio} from './audio.mjs';
import {setText,startRenderLoop,readQuality} from './performance.mjs';
const id=location.pathname.split('/')[2];
const config={
 'prism-breaker':{title:'Prism Breaker',label:'01 / REFRACTION LAB',accent:'#b7a2ff',intro:'Find the angle. Break the spectrum.',goal:'Clear the prism wall. Chain brick hits for a bigger multiplier. Three lives, endless waves.',keys:['←','→','A','D'],tip:'Move with the arrow keys, drag across the board, or hold the touch arrows. Keep the ball above your paddle.'},
 'neon-coil':{title:'Neon Coil',label:'02 / LIVING CIRCUIT',accent:'#84efba',intro:'A little hunger. A longer circuit.',goal:'Collect the glowing nodes. Grow your circuit without crossing yourself or touching the edge.',keys:['↑','←','↓','→'],tip:'Arrow keys or WASD to turn. Swipe on the board or use the direction buttons. The pace increases as you grow.'},
 'starfall':{title:'Starfall',label:'03 / ORBITAL DEFENCE',accent:'#7edaff',intro:'Hold the line. Light up the night.',goal:'Break through each descending formation. Dodge return fire and survive the next wave.',keys:['←','→','SPACE'],tip:'Move with A/D or arrows, hold Space to fire. On touch, drag to steer and fire, or use the buttons below.'},
 'drift-run':{title:'Drift Run',label:'04 / AFTER HOURS',accent:'#ffbc83',intro:'Three lanes. One way forward.',goal:'Slip between the barriers. Catch amber energy rings as the city rushes past.',keys:['←','→','A','D'],tip:'Tap left or right to change lanes. Swipe sideways on the road, or use the touch arrows. Stay clear of the coral barriers.'}
}[id];
if(!config||!kinds.includes(id))throw Error('Unknown arcade game');
const $=s=>document.querySelector(s),canvas=$('canvas');
const renderer=new ArcadeRenderer(canvas,id,config.accent),input=new InputBuffer(id),audio=new ArcadeAudio();
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
let predicted=createGame(id),previous=structuredClone(predicted),confirmed=null,pending=[],sending=null;
let running=false,loaded=false,stopping=false,accumulator=0,saveTimer=0,countdown=0,lastCount=0;
let pointerX=null,pointerHeld=false,startPoint=null,best=Number(read(`utxoplay:best:${id}`,'0'))||0;
let noticeTime=0;
const status=t=>setText('status',t);
const announce=t=>setText('announcement',t);
function clearInput(){input.clear();pointerHeld=false;pointerX=null;startPoint=null;document.querySelectorAll('[data-input]').forEach(b=>b.classList.remove('pressed'));}
function syncView(){previous=structuredClone(predicted);renderer.reset();accumulator=0;}
function showOverlay(title,text,button,art=false){setText('overlay-title',title);setText('overlay-text',text);setText('launch',button);$('#overlay').dataset.art=String(art);$('#overlay').hidden=false;$('#countdown').hidden=true;countdown=0;}
function toast(text){setText('notice',text);$('#notice').hidden=false;noticeTime=1800;announce(text);}
function rememberBest(){if(confirmed.game.score>best){best=confirmed.game.score;write(`utxoplay:best:${id}`,best);}setText('best',best.toLocaleString());}
function begin(){clearInput();syncView();$('#overlay').hidden=true;$('#pause').textContent='Pause';countdown=1800;lastCount=0;$('#countdown').hidden=false;setText('countdown','3');canvas.focus();}
document.documentElement.style.setProperty('--accent',config.accent);document.documentElement.dataset.game=id;document.title=config.title+' · UTXOPlay';
document.documentElement.style.setProperty('--key-art',`url('/assets/${id}-keyart.webp')`);
setText('title',config.title);setText('eyebrow',config.label);setText('intro',config.intro);setText('goal',config.goal);setText('controls',config.tip);setText('best',best.toLocaleString());
$('#cover').src=`/assets/${id}-keyart.webp`;$('#cover').alt=config.title+' original arcade key art';
setText('level-label',id==='neon-coil'||id==='drift-run'?'PACE':'WAVE');
for(const key of config.keys){const k=document.createElement('kbd');k.textContent=key;$('#keys').append(k);}
for(const b of document.querySelectorAll('.touch button'))if((id!=='neon-coil'&&[4,8].includes(+b.dataset.input))||(id!=='starfall'&&+b.dataset.input===16))b.hidden=true;
audio.enabled=read('utxoplay:arcade-sound','off')==='on';
function soundLabel(){setText('sound',audio.enabled?'Sound on':'Sound off');$('#sound').setAttribute('aria-pressed',String(audio.enabled));}
soundLabel();$('#quality').value=readQuality();
$('#quality').onchange=e=>{write('utxoplay:quality',e.target.value);dispatchEvent(new Event('utxoplay:quality'));if(running)canvas.focus();};
async function api(endpoint,body){const r=await fetch('./api/'+endpoint,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const v=await r.json();if(!r.ok)throw Error(v.error||'Game service unavailable');return v;}
async function flush(){
  if(sending)return sending;if(!pending.length||!confirmed)return;
  const tape=pending.splice(0,60),before=confirmed;
  const task=(async()=>{try{
    const result=await api('action',{session_id:before.session.id,expected_block:before.session.block_hash,action:{type:'ticks',inputs:tape}});
    confirmed=result;
    // Keep visual history when prediction agrees; reconcile only on a real correction.
    const authoritative=structuredClone(result.game);for(const i of pending)step(authoritative,i);
    if(JSON.stringify(authoritative)!==JSON.stringify(predicted)){predicted=authoritative;syncView();clearInput();}
    rememberBest();status(`Saved · ${result.session.actions} Myelin frames`);
  }catch(e){
    running=false;countdown=0;clearInput();pending=[];
    try{confirmed=await api('state');predicted=structuredClone(confirmed.game);}catch{loaded=false;}
    syncView();showOverlay('Connection paused',loaded?'Your confirmed run is safe. Resume when your connection is ready.':'Reconnect to recover your saved run.',loaded?'Resume':'Reconnect');status(e.message);announce('Connection interrupted. Game paused.');throw e;
  }})();
  sending=task;try{await task;}finally{sending=null;}
}
async function saveAll(){while(sending||pending.length){if(sending)await sending;else await flush();}}
async function finish(){
  if(stopping)return;stopping=true;running=false;clearInput();status('Saving your final score…');
  try{await saveAll();rememberBest();showOverlay('Run complete',`${confirmed.game.score.toLocaleString()} points · ${Math.floor(confirmed.game.tick/30)} seconds. ${confirmed.game.score>=best&&best>0?'Your best on this device!':'One more try?'}`,'Play again');announce('Run complete. '+confirmed.game.score+' points.');}catch{}finally{stopping=false;}
}
async function boot(){
  try{confirmed=await api('state');predicted=structuredClone(confirmed.game);syncView();loaded=true;rememberBest();$('#launch').disabled=false;
    showOverlay(predicted.over?'Your last run':config.title,predicted.tick?`${predicted.score} points saved. ${predicted.over?'Ready for another run?':'Pick up where you left off.'}`:config.intro,predicted.over?'Play again':predicted.tick?'Continue run':'Start playing',true);
    status('Connected · progress saves as you play');
  }catch(e){showOverlay('Connecting failed',e.message,'Retry connection',true);$('#launch').disabled=false;status('Unable to load your session.');}
}
$('#launch').onclick=async()=>{
  if(stopping||running||countdown)return;$('#launch').disabled=true;audio.unlock();
  try{if(!loaded){await boot();return;}await saveAll();if(predicted.over){confirmed=await api('new',{});predicted=structuredClone(confirmed.game);}begin();}
  catch(e){status(e.message);}finally{$('#launch').disabled=false;}
};
async function pause(){
  if(!running&&!countdown)return;running=false;countdown=0;clearInput();setText('pause','Resume');
  showOverlay('Take a breath','Your run is paused. Continue whenever you’re ready.','Resume');announce('Game paused');
  try{await saveAll();}catch{}
}
$('#pause').onclick=()=>running||countdown?pause():$('#launch').click();
$('#restart').onclick=async()=>{
  if(stopping||!loaded)return;
  await pause();
  if(!confirm('Start a new run? Your current run will end.'))return;
  stopping=true;clearInput();try{await saveAll();confirmed=await api('new',{});predicted=structuredClone(confirmed.game);syncView();showOverlay(config.title,config.intro,'Start playing',true);status('New run ready.');}
  catch(e){status(e.message);}finally{stopping=false;}
};
$('#sound').onclick=()=>{audio.enabled=!audio.enabled;write('utxoplay:arcade-sound',audio.enabled?'on':'off');soundLabel();audio.unlock();audio.play('start');if(running)canvas.focus();};
$('#replay').onclick=async()=>{await pause();$('#replay').disabled=true;try{await saveAll();const v=await api('replay',{});status(`Replay verified · ${v.frames} signed frames · ${v.state_root?.slice(0,16)||'genesis'}`);announce('Myelin replay verified');}catch(e){status(e.message);}finally{$('#replay').disabled=false;}};
$('#export').onclick=async e=>{e.preventDefault();await pause();try{await saveAll();const v=await api('export');const u=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=`${id}-myelin-session.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}catch(err){status(err.message);}};
const mapping={ArrowLeft:1,KeyA:1,ArrowRight:2,KeyD:2,ArrowUp:4,KeyW:4,ArrowDown:8,KeyS:8,Space:16};
addEventListener('keydown',e=>{
  if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)void pause();return;}
  if(!running||e.target.closest?.('input,select,textarea,a,button'))return;
  const bit=mapping[e.code];if(bit){e.preventDefault();if(!e.repeat)input.press(e.code,bit,predicted);}
});
addEventListener('keyup',e=>{if(mapping[e.code]){input.release(e.code);if(running)e.preventDefault();}});
addEventListener('blur',()=>{clearInput();void pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();void pause();}});
addEventListener('offline',()=>{void pause();status('You are offline. Reconnect to save and continue.');});
for(const b of document.querySelectorAll('[data-input]')){
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!running)return;b.setPointerCapture(e.pointerId);input.press('touch'+e.pointerId,+b.dataset.input,predicted);b.classList.add('pressed');});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>{input.release('touch'+e.pointerId);b.classList.remove('pressed');});
}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000));}
canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(!running)return;canvas.focus();canvas.setPointerCapture(e.pointerId);pointerHeld=true;startPoint=[e.clientX,e.clientY];pointerX=pointerPosition(e);});
canvas.addEventListener('pointermove',e=>{
  if(!pointerHeld)return;pointerX=pointerPosition(e);
  if(startPoint&&(id==='neon-coil'||id==='drift-run')){
    const dx=e.clientX-startPoint[0],dy=e.clientY-startPoint[1];
    if(Math.max(Math.abs(dx),Math.abs(dy))>=18){if(id==='neon-coil'||Math.abs(dx)>Math.abs(dy))input.pulse(Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?8:4,predicted);startPoint=[e.clientX,e.clientY];}
  }
});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{pointerHeld=false;startPoint=null;});
function controls(){let bits=input.read(predicted);if(pointerHeld&&pointerX!==null&&(id==='prism-breaker'||id==='starfall')){bits&=~3;if(pointerX<predicted.x-12)bits|=1;else if(pointerX>predicted.x+12)bits|=2;if(id==='starfall')bits|=16;}return bits;}
function frame(now,delta,ratio){
  if(countdown){countdown=Math.max(0,countdown-delta);const number=Math.ceil(countdown/600);if(number!==lastCount){lastCount=number;setText('countdown',number||'GO');audio.play(number?'count':'start');}if(!countdown){$('#countdown').hidden=true;running=true;accumulator=0;saveTimer=0;announce('Go');}}
  else if(running){
    accumulator+=delta;
    while(accumulator>=1000/30&&running){
      if(pending.length>=60){running=false;clearInput();showOverlay('Saving your run','Waiting for your connection to catch up.','Resume');break;}
      previous=structuredClone(predicted);const bits=controls();pending.push(bits);step(predicted,bits);input.stepped(previous,predicted);renderer.tick(predicted);
      for(const e of feedback(previous,predicted)){renderer.event(e);audio.play(e.type);if(e.type==='wave')toast((id==='neon-coil'||id==='drift-run'?'Pace ':'Wave ')+e.value);if(e.type==='damage'&&!predicted.over)toast(predicted.lives+' lives left');}
      accumulator-=1000/30;if(predicted.over){void finish();break;}
    }
    saveTimer+=delta;if(saveTimer>=1000){saveTimer=0;void flush().catch(()=>{});}
  }
  if(noticeTime>0){noticeTime-=delta;if(noticeTime<=0)$('#notice').hidden=true;}
  renderer.draw(predicted,previous,accumulator/(1000/30),delta,ratio,{running,reduced:motion.matches,low:readQuality()==='low'||ratio<=1});
  setText('score',predicted.score.toLocaleString());setText('level',String(predicted.level).padStart(2,'0'));
  const maxLives=id==='neon-coil'||id==='drift-run'?1:3;
  setText('lives','●'.repeat(predicted.lives)+'○'.repeat(maxLives-predicted.lives));$('#lives').setAttribute('aria-label',predicted.lives+' lives remaining');
  setText('time',`${Math.floor(predicted.tick/1800)}:${String(Math.floor(predicted.tick/30)%60).padStart(2,'0')}`);
}
showOverlay(config.title,'Connecting to your saved Myelin session…','Connecting…',true);$('#launch').disabled=true;void boot();
startRenderLoop(frame,{active:()=>running||countdown>0});
