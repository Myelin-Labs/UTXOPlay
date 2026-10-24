import {PERKS,levels} from './prism-engine.mjs';
import {pointerInViewport} from './viewport.mjs';
import {createGame,step,kinds} from './engine.mjs';
import {InputBuffer,BoardGesture,feedback,runSummary} from './presentation.mjs';
import {ArcadeRenderer} from './renderer.mjs';
import {ArcadeAudio} from './audio.mjs';
import {setText,startRenderLoop,readQuality} from './performance.mjs';
globalThis.UTXOPlayLoader?.boot();
const id=location.pathname.split('/')[2];
const config={
 'prism-breaker':{title:'Prism Breaker',label:'01 / REFRACTION LAB',accent:'#b7a2ff',intro:'Bend light. Rewrite the angle.',goal:'Conquer 24 distinct crystal sectors. Collect six capsule types, break armoured and explosive gems, and choose a permanent perk after every sector. Break crystals to charge Refraction. Q / E bends every ball up-left / up-right for 4 charge. Space fires a column pulse every 12 seconds.',keys:['←','→','Q','E','SPACE'],tip:'Mouse, arrows or touch drag steer the paddle. F toggles Focus Lens: a projected path and landing marker with the paddle held still. Aim with the edges to change the return angle.'},
 'neon-coil':{title:'Neon Coil',label:'02 / LIVING CIRCUIT',accent:'#84efba',intro:'Grow a circuit. Close it. Cash it in.',goal:'Eat nodes until your coil has at least 9 segments. Turn back into a distant segment to enclose empty tiles: the circuit discharges for 40 + 10 per tile, leaving a short tail. Small knots and walls are still fatal.',keys:['↑','←','↓','→'],tip:'Arrow keys or WASD to turn. Swipe on the board or use the direction buttons. Gold segments mark possible connection points. Enclose at least one whole grid tile; a tight knot will not discharge.'},
 'starfall':{title:'Starfall',label:'03 / ORBITAL DEFENCE',accent:'#7edaff',intro:'Catch their fire. Send it home.',goal:'Hold W or CAPTURE to absorb up to 6 enemy shots, then release to reflect a spreading volley. Shooting pauses while you capture. Hold for 1.5 seconds and the shield overheats for 2 seconds: choose your window carefully.',keys:['←','→','W','SPACE'],tip:'Move the mouse, use A/D, or drag to steer. Auto fire is on by default; turn it off to fire manually with Space or FIRE.'},
 'drift-run':{title:'Drift Run',label:'04 / AFTER HOURS',accent:'#ffbc83',intro:'Leave an echo. Steal a second line.',goal:'Changing lanes leaves a short-lived echo that can catch rings in the lane you left. Echo rings and close passes beside barriers charge OVERDRIVE. Spend 3 charge with Space to smash through barriers for 1.5 seconds.',keys:['←','→','SPACE'],tip:'Tap left or right to change lanes. Swipe sideways on the road, or use the touch arrows. Stay clear of the coral barriers.'}
}[id];
if(!config||!kinds.includes(id))throw Error('Unknown arcade game');
const $=s=>document.querySelector(s),canvas=$('canvas');
const {PrismRenderer}=id==='prism-breaker'?await import('./prism-renderer.mjs'):{};
const renderer=id==='prism-breaker'?new PrismRenderer(canvas):new ArcadeRenderer(canvas,id,config.accent);
const input=new InputBuffer(id),gesture=new BoardGesture(id),audio=new ArcadeAudio();
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
let predicted=createGame(id),previous=structuredClone(predicted),confirmed=null,pending=[],sending=null;
let running=false,loaded=false,stopping=false,accumulator=0,saveTimer=0,countdown=0,lastCount=0;
let best=Number(read(`utxoplay:best:signature:${id}`,'0'))||0,runBest=best;
let autoFire=read('utxoplay:autofire','on')==='on',hoverX=null,overlayAction='play',resumeEpoch=0,busy=false;
let noticeTime=0,quality=readQuality(),artworkReady=false;
if(id==='prism-breaker'){
 renderer.setLens(read('utxoplay:prism-lens','on')==='on');
 const lens=$('#prism-lens');
 const label=()=>{lens.setAttribute('aria-pressed',String(renderer.lens));lens.querySelector('span').textContent=renderer.lens?'Direction hint ON':'Direction hint OFF';};
 lens.onclick=()=>{renderer.setLens(!renderer.lens);write('utxoplay:prism-lens',renderer.lens?'on':'off');label();if(running||countdown)canvas.focus();};label();
}
async function prepareArtwork(){if(!artworkReady){await renderer.load($('#cover'));artworkReady=true;}}
// Scene-owned instrumentation and controls share the exact signed input tape.
const signatures={
 'prism-breaker':{name:'REFRACTION',hint:'Break crystals · spend 4 to bend light',buttons:[[4,'↖','Bend left','Q'],[8,'↗','Bend right','E']]},
 'neon-coil':{name:'CLOSED CIRCUIT',hint:'Grow to 9 · enclose a tile · discharge',buttons:[]},
 starfall:{name:'CAPTURE / REFLECT',hint:'Hold to absorb · release to return fire',buttons:[[4,'◉','Capture','W · HOLD']]},
 'drift-run':{name:'ECHO DRIVE',hint:'Echo rings + close passes charge a burst',buttons:[[16,'»','Overdrive','SPACE']]}
};
const signature=signatures[id],instrument=document.createElement('section');
instrument.className='signature-mechanic';instrument.setAttribute('aria-label',signature.name);
instrument.innerHTML='<div class="signature-heading"><span></span><strong id="signature-value"></strong></div><div class="signature-meter" role="meter" aria-label="Ability charge" aria-valuemin="0" aria-valuemax="6"><i></i></div><small id="signature-hint"></small>';
instrument.querySelector('span').textContent=signature.name;
instrument.querySelector('small').textContent=signature.hint;
$('.board').append(instrument);
const abilities=document.createElement('div');abilities.className='signature-actions';abilities.setAttribute('aria-label','Special abilities');
for(const [bit,glyph,label,key] of signature.buttons){const button=document.createElement('button');button.type='button';button.dataset.input=bit;button.setAttribute('aria-label',label+' · '+key);button.innerHTML='<b></b><span></span><kbd></kbd>';button.querySelector('b').textContent=glyph;button.querySelector('span').textContent=label;button.querySelector('kbd').textContent=key;abilities.append(button);}
$('.board').append(abilities);
const meter=instrument.querySelector('[role="meter"]');
let signatureCache='';
function updateSignature(){
 const g=predicted;
 const max=id==='prism-breaker'?6:id==='neon-coil'?9:id==='drift-run'?3:6;
 const charge=id==='prism-breaker'?g.refraction:id==='neon-coil'?Math.min(9,g.trail.length):g.energy;
 const ready=id==='prism-breaker'?charge>=4:id==='neon-coil'?charge>=9:id==='drift-run'?charge>=3:!g.ability_lock;
 const active=id!=='prism-breaker'&&g.ability_ticks>0;
 const detail=id==='prism-breaker'?`${charge}/6 · COST 4`:id==='neon-coil'?`${g.trail.length} SEGMENTS`:id==='drift-run'?(active?'OVERDRIVE':`${charge}/3`):g.ability_lock?`COOLING ${Math.ceil(g.ability_lock/30)}s`:`${charge}/6 · ${Math.round(g.ability_ticks/45*100)}% HEAT`;
 const hint=id==='neon-coil'&&active?`${g.loop_area} tiles discharged · ${g.specials} circuits`:id==='neon-coil'&&ready?'Connect to gold · leave an empty tile inside':id==='drift-run'&&g.echo_ticks?'Echo collecting in your previous lane':signature.hint;
 const key=[charge,detail,hint,ready,active,running].join('|');if(key===signatureCache)return;signatureCache=key;
 setText('signature-value',detail);setText('signature-hint',hint);
 meter.setAttribute('aria-valuemax',String(max));meter.setAttribute('aria-valuenow',String(charge));meter.style.setProperty('--charge',charge/max*100+'%');
 instrument.dataset.ready=String(ready);instrument.dataset.active=String(active);abilities.dataset.ready=String(ready);
 for(const button of abilities.children)button.setAttribute('aria-disabled',String(!running||!ready||(id==='drift-run'&&active)));
}
const hud={};
function updateHud(){
  updateSignature();
  if(id==='prism-breaker'){
    setText('prism-sector',levels[predicted.level-1].name);
    setText('prism-owned',predicted.perks.map((rank,i)=>rank?PERKS[i].name+' '+rank+'/4':'').filter(Boolean).join(' · ')||'Clear a sector to choose your first perk.');
    setText('prism-pulse',predicted.cooldown?'PULSE '+Math.ceil(predicted.cooldown/30)+'s':'PULSE · SPACE');
    $('#prism-pulse').setAttribute('aria-disabled',String(!running||predicted.cooldown>0));
    const effects=[predicted.wide?'LONGBOARD '+Math.ceil(predicted.wide/30)+'s':'',predicted.slow?'SLOW '+Math.ceil(predicted.slow/30)+'s':'',predicted.pierce?'PHASE '+Math.ceil(predicted.pierce/30)+'s':'',predicted.shield?'SHIELD ×'+predicted.shield:''].filter(Boolean);
    setText('prism-effects',effects.join(' · ')||'Catch capsules · Space to pulse');
  }

  if(hud.score!==predicted.score){hud.score=predicted.score;setText('score',predicted.score.toLocaleString());}
  if(hud.level!==predicted.level){hud.level=predicted.level;setText('level',String(predicted.level).padStart(2,'0'));}
  if(hud.lives!==predicted.lives){
    hud.lives=predicted.lives;const maxLives=id==='neon-coil'||id==='drift-run'?1:3;
    setText('lives','●'.repeat(predicted.lives)+'○'.repeat(maxLives-predicted.lives));
    if(id==='prism-breaker')$('#lives').replaceChildren(...Array.from({length:3},(_,n)=>{const heart=document.createElement('img');heart.src='/arcade/art/prism-heart.webp?v=0.24.0';heart.alt='';heart.style.opacity=n<predicted.lives?'1':'.2';return heart;}));
    $('#lives').setAttribute('aria-label',predicted.lives+' lives remaining');
  }
  const seconds=Math.floor(predicted.tick/30);
  if(hud.seconds!==seconds){hud.seconds=seconds;setText('time',`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`);}
}
const qualityChanged=()=>{quality=readQuality();};
addEventListener('storage',qualityChanged);addEventListener('utxoplay:quality',qualityChanged);
const status=t=>setText('status',t);
const announce=t=>setText('announcement',t);
function clearInput(){input.clear();gesture.clear();hoverX=null;document.querySelectorAll('[data-input]').forEach(b=>b.classList.remove('pressed'));}
function syncView(){previous=structuredClone(predicted);renderer.reset();accumulator=0;}
function showOverlay(title,text,button,art=false){overlayAction='play';$('#cancel-restart').hidden=true;$('#run-stats').hidden=true;setText('overlay-title',title);setText('overlay-text',text);setText('launch',button);$('#overlay').dataset.art=String(art);$('#overlay').hidden=false;$('#countdown').hidden=true;countdown=0;}
function refreshButtons(){
  $('#launch').disabled=busy||stopping||drafting;
  for(const name of ['restart','replay','pause'])$('#'+name).disabled=busy||stopping||drafting||!loaded;
  $('#cancel-restart').disabled=busy||stopping;
  $('#export').setAttribute('aria-disabled',String(busy||stopping||!loaded));
}
function focusLaunch(){if(!document.hidden&&!$('#launch').disabled)$('#launch').focus({preventScroll:true});}
function toast(text){setText('notice',text);$('#notice').hidden=false;noticeTime=1800;announce(text);}
function rememberBest(){if(confirmed.game.score>best){best=confirmed.game.score;write(`utxoplay:best:signature:${id}`,best);}setText('best',best.toLocaleString());}
function begin(){if(predicted.draft){void showPerks();return;}clearInput();syncView();$('#notice').hidden=true;noticeTime=0;$('#overlay').hidden=true;$('#pause').textContent='Pause';countdown=1800;lastCount=0;$('#countdown').hidden=false;setText('countdown','3');canvas.focus();}
document.documentElement.style.setProperty('--accent',config.accent);document.documentElement.dataset.game=id;document.title=config.title+' · UTXOPlay';
document.documentElement.style.setProperty('--key-art',`url('/assets/${id}-keyart.webp${id==='prism-breaker'?'?v=0.15.0':''}')`);
setText('title',config.title);setText('eyebrow',config.label);setText('intro',config.intro);setText('goal',config.goal);setText('controls',config.tip);setText('best',best.toLocaleString());
$('#cover').src=`/assets/${id}-keyart.webp${id==='prism-breaker'?'?v=0.15.0':''}`;$('#cover').alt=config.title+' original arcade key art';
setText('level-label',id==='neon-coil'||id==='drift-run'?'PACE':'WAVE');
for(const key of config.keys){const k=document.createElement('kbd');k.textContent=key;$('#keys').append(k);}
for(const b of document.querySelectorAll('.touch button'))if((id!=='neon-coil'&&[4,8].includes(+b.dataset.input))||(id!=='starfall'&&+b.dataset.input===16))b.hidden=true;
audio.enabled=read('utxoplay:arcade-sound','off')==='on';
function soundLabel(){setText('sound',audio.enabled?'Sound on':'Sound off');$('#sound').setAttribute('aria-pressed',String(audio.enabled));}
soundLabel();$('#quality').value=readQuality();
const hints={'prism-breaker':'Mouse to aim · drag or hold arrows on touch','neon-coil':'Swipe once per turn · or use the D-pad',starfall:'Drag to steer · Space or FIRE for manual shots','drift-run':'One swipe = one lane · arrows also work'};
setText('play-hint',hints[id]);
function fireLabel(){setText('autofire',autoFire?'Auto fire on':'Auto fire off');$('#autofire').setAttribute('aria-pressed',String(autoFire));}
$('#autofire').hidden=id!=='starfall';fireLabel();
$('#autofire').onclick=()=>{autoFire=!autoFire;write('utxoplay:autofire',autoFire?'on':'off');fireLabel();if(running||countdown)canvas.focus();};
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
    resumeEpoch++;running=false;countdown=0;clearInput();pending=[];
    try{confirmed=await api('state');predicted=structuredClone(confirmed.game);}catch{loaded=false;}
    syncView();showOverlay('Connection paused',loaded?'Your confirmed run is safe. Resume when your connection is ready.':'Reconnect to recover your saved run.',loaded?'Resume':'Reconnect');status(e.message);announce('Connection interrupted. Game paused.');throw e;
  }})();
  sending=task;try{await task;}finally{sending=null;}
}
async function saveAll(){while(sending||pending.length){if(sending)await sending;else await flush();}}
async function finish(){
  if(stopping)return;stopping=true;running=false;clearInput();status('Saving your final score…');
  showOverlay('Run complete','Saving your score…','Saving…');showStats(predicted);refreshButtons();
  try{await saveAll();rememberBest();const summary=runSummary(confirmed.game,runBest);showOverlay(summary.title,summary.tip,'Play again');showStats(confirmed.game);announce('Run complete. '+confirmed.game.score+' points.');}
  catch{}finally{stopping=false;refreshButtons();focusLaunch();}
}
function showStats(game){const summary=runSummary(game,runBest);$('#run-stats').hidden=false;setText('result-score',game.score.toLocaleString());setText('result-time',summary.duration);setText('result-best',best.toLocaleString());}

let drafting=false;
async function showPerks(){
 if(drafting)return;drafting=true;refreshButtons();running=false;countdown=0;clearInput();$('#countdown').hidden=true;
 showOverlay('Sector restored','Saving your clear…','Saving…');$('#launch').disabled=true;
 try{await saveAll();if(!confirmed.game.draft)return;predicted=structuredClone(confirmed.game);syncView();$('#overlay').hidden=true;const panel=$('#prism-draft');panel.hidden=false;setText('prism-draft-title','Sector '+predicted.level+' complete');const cards=$('#prism-perks');cards.replaceChildren();
 for(const choice of predicted.offers){const perk=PERKS[choice],button=document.createElement('button');button.className='perk-card';const img=document.createElement('img');img.src='/arcade/art/prism-'+perk.icon+'.webp?v=0.24.0';img.alt='';const title=document.createElement('strong');title.textContent=perk.name;const desc=document.createElement('span');desc.textContent=perk.detail;const rank=document.createElement('small');rank.textContent='RANK '+(predicted.perks[choice]+1)+' / 4';button.append(img,rank,title,desc);button.onclick=()=>void selectPerk(choice);cards.append(button);}
 cards.querySelector('button')?.focus({preventScroll:true});announce('Sector complete. Choose one permanent perk.');
 }catch(e){status(e.message);}finally{drafting=false;refreshButtons();}
}
async function selectPerk(choice){
 if(busy||!confirmed?.game.draft)return;busy=true;refreshButtons();$('#prism-perks').querySelectorAll('button').forEach(b=>b.disabled=true);
 try{const state=await api('action',{session_id:confirmed.session.id,expected_block:confirmed.session.block_hash,action:{type:'perk',choice}});confirmed=state;predicted=structuredClone(state.game);syncView();$('#prism-draft').hidden=true;showOverlay('Sector '+predicted.level+' · '+levels[predicted.level-1].name,'Upgrade installed. Your new build is saved.','Enter sector');}
 catch(e){status(e.message);try{confirmed=await api('state');predicted=structuredClone(confirmed.game);syncView();$('#prism-draft').hidden=true;if(predicted.draft)await showPerks();else showOverlay('Upgrade saved','Your run is ready.','Enter sector');}catch{loaded=false;$('#prism-draft').hidden=true;showOverlay('Connection paused','Reconnect to recover your confirmed upgrade.','Reconnect');}}
 finally{busy=false;refreshButtons();$('#prism-perks').querySelectorAll('button').forEach(b=>b.disabled=false);}
}
if(id==='prism-breaker'){
 const pulse=$('#prism-pulse');pulse.addEventListener('pointerdown',e=>{if(!running)return;e.preventDefault();pulse.setPointerCapture(e.pointerId);input.press('pulse',16,predicted);});for(const event of ['pointerup','pointercancel','lostpointercapture'])pulse.addEventListener(event,()=>input.release('pulse'));pulse.addEventListener('click',e=>{if(e.detail===0&&running){input.press('pulse-key',16,predicted);setTimeout(()=>input.release('pulse-key'),100);}});
}

async function boot(){
  try{const [state]=await Promise.all([api('state').then(state=>{globalThis.UTXOPlayLoader?.session();return state;},error=>{globalThis.UTXOPlayLoader?.fail('session');throw error;}),prepareArtwork()]);confirmed=state;predicted=structuredClone(confirmed.game);syncView();updateHud();loaded=true;runBest=best;rememberBest();
    showOverlay(predicted.over?'Your last run':config.title,predicted.tick?`${predicted.score} points saved. ${predicted.over?'Ready for another run?':'Pick up where you left off.'}`:config.intro+' '+config.goal,predicted.over?'Play again':predicted.tick?'Continue run':'Start playing',true);
    status('Connected · progress saves as you play');globalThis.UTXOPlayLoader?.session();globalThis.UTXOPlayLoader?.ready();
  }catch(e){if(!globalThis.UTXOPlayLoader?.state?.error)globalThis.UTXOPlayLoader?.fail('game');loaded=false;showOverlay('Connecting failed',e.message,'Retry connection',true);status('Unable to load your session.');}
  finally{refreshButtons();}
}
$('#launch').onclick=async()=>{
  if(stopping||busy||running||countdown)return;
  const restart=overlayAction==='restart',epoch=++resumeEpoch;busy=true;refreshButtons();audio.unlock();
  try{
    if(!loaded){await boot();if(!loaded)return;}
    await saveAll();
    if(epoch!==resumeEpoch||document.hidden)return;
    if(restart||predicted.over){confirmed=await api('new',{});predicted=structuredClone(confirmed.game);runBest=best;syncView();}
    if(epoch!==resumeEpoch||document.hidden){showOverlay('Ready when you are','Your run is paused.','Resume');return;}
    overlayAction='play';begin();
  }catch(e){status(e.message);}
  finally{busy=false;refreshButtons();}
};
async function pause(){
  resumeEpoch++;
  if(!running&&!countdown)return;running=false;countdown=0;clearInput();setText('pause','Resume');
  showOverlay('Take a breath','Your run is paused. Continue whenever you’re ready.','Resume');announce('Game paused');
  focusLaunch();try{await saveAll();}catch{}
}
$('#pause').onclick=()=>{if(busy||stopping)return;if(overlayAction==='restart')return $('#cancel-restart').click();return running||countdown?pause():$('#launch').click();};
$('#restart').onclick=async()=>{
  if(stopping||busy||!loaded)return;
  busy=true;refreshButtons();
  try{await pause();await saveAll();if(id==='prism-breaker')$('#prism-draft').hidden=true;showOverlay('Start a new run?',`Your current ${predicted.score.toLocaleString()}-point run will end.`,'Start new run');overlayAction='restart';$('#cancel-restart').hidden=false;}
  catch(e){status(e.message);}
  finally{busy=false;refreshButtons();if(!document.hidden)$('#cancel-restart').hidden?focusLaunch():$('#cancel-restart').focus({preventScroll:true});}
};
$('#cancel-restart').onclick=()=>{if(busy||stopping)return;showOverlay('Take a breath','Your current run is safe.','Resume');$('#launch').click();};
$('#sound').onclick=()=>{audio.enabled=!audio.enabled;write('utxoplay:arcade-sound',audio.enabled?'on':'off');soundLabel();audio.unlock();audio.play('start');if(running)canvas.focus();};
$('#replay').onclick=async()=>{if(busy||stopping||!loaded)return;busy=true;refreshButtons();await pause();try{await saveAll();const v=await api('replay',{});status(`Replay verified · ${v.frames} signed frames · ${v.state_root?.slice(0,16)||'genesis'}`);announce('Myelin replay verified');}catch(e){status(e.message);}finally{busy=false;refreshButtons();focusLaunch();}};
$('#export').onclick=async e=>{e.preventDefault();if(busy||stopping||!loaded)return;busy=true;refreshButtons();await pause();try{await saveAll();const v=await api('export');const u=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=`${id}-myelin-session.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}catch(err){status(err.message);}finally{busy=false;refreshButtons();focusLaunch();}};
const mapping={ArrowLeft:1,KeyA:1,ArrowRight:2,KeyD:2,ArrowUp:4,KeyW:4,ArrowDown:8,KeyS:8,Space:16,...(id==='prism-breaker'?{KeyQ:4,KeyE:8}:{}),...(id==='starfall'?{ShiftLeft:4,ShiftRight:4}:{})};
addEventListener('keydown',e=>{
  if(e.target.closest?.('input,select,textarea,a'))return;
  if(e.code==='Escape'){
    if(!e.repeat){if(overlayAction==='restart')$('#cancel-restart').click();else void pause();}return;
  }
  if(id==='prism-breaker'&&e.code==='KeyF'&&!e.target.closest?.('button')){e.preventDefault();if(!e.repeat)$('#prism-lens').click();return;}
  if(e.code==='KeyP'){e.preventDefault();if(!e.repeat)$('#pause').click();return;}
  if(e.code==='KeyR'){e.preventDefault();if(!e.repeat)$('#restart').click();return;}
  if(e.code==='Enter'&&!e.target.closest?.('button')&&!$('#overlay').hidden){e.preventDefault();if(!e.repeat)$('#launch').click();return;}
  if((!running&&!countdown)||e.target.closest?.('button'))return;
  const bit=mapping[e.code];if(bit){e.preventDefault();if(!e.repeat){hoverX=null;input.press(e.code,bit,predicted);}}
});
addEventListener('keyup',e=>{if(mapping[e.code]){input.release(e.code);if(running||countdown)e.preventDefault();}});
addEventListener('blur',()=>{clearInput();void pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();void pause();}});
addEventListener('offline',()=>{void pause();status('You are offline. Reconnect to save and continue.');});
for(const b of document.querySelectorAll('[data-input]')){
  if(b.closest('.signature-actions')&&id!=='starfall')b.addEventListener('click',e=>{if(e.detail===0&&running){const source='accessible'+b.dataset.input;input.press(source,+b.dataset.input,predicted);input.release(source);}});
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!running&&!countdown)return;b.setPointerCapture(e.pointerId);input.press('touch'+e.pointerId,+b.dataset.input,predicted);b.classList.add('pressed');});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,e=>{input.release('touch'+e.pointerId);b.classList.remove('pressed');});
  b.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&(running||countdown)){e.preventDefault();if(!e.repeat){input.press('button'+b.dataset.input,+b.dataset.input,predicted);b.classList.add('pressed');}}});
  b.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();input.release('button'+b.dataset.input);b.classList.remove('pressed');}});
  b.addEventListener('blur',()=>{input.release('button'+b.dataset.input);b.classList.remove('pressed');});
}
function pointerPosition(e){return pointerInViewport(e.clientX,e.clientY,canvas.getBoundingClientRect(),id,matchMedia('(pointer:coarse)').matches);}
canvas.addEventListener('pointerdown',e=>{
  if((!running&&!countdown)||e.button!==0)return;e.preventDefault();
  const p=pointerPosition(e);if(!gesture.begin(e.pointerId,p.x,p.y,e.pointerType==='mouse'?p.x:predicted.x))return;
  canvas.focus();canvas.setPointerCapture(e.pointerId);hoverX=null;
});
canvas.addEventListener('pointermove',e=>{
  if(!running&&!countdown)return;const p=pointerPosition(e);
  if(gesture.owner!==null){const bit=gesture.move(e.pointerId,p.x,p.y);if(bit)input.pulse(bit,predicted);}
  else if(e.pointerType==='mouse'&&(id==='prism-breaker'||id==='starfall'))hoverX=p.x;
});
canvas.addEventListener('pointerleave',()=>{hoverX=null;});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,e=>gesture.end(e.pointerId));
function controls(){
  let bits=input.read(predicted);if(id==='starfall'&&autoFire)bits|=16;
  const target=gesture.target??hoverX;
  if(target!==null&&(id==='prism-breaker'||id==='starfall')){
    bits&=~3;if(target<predicted.x-12)bits|=1;else if(target>predicted.x+12)bits|=2;
    if(id==='starfall'&&gesture.owner!==null)bits|=16;
  }
  return bits;
}
function frame(now,delta,ratio){
  if(countdown){countdown=Math.max(0,countdown-delta);const number=Math.ceil(countdown/600);if(number!==lastCount){lastCount=number;setText('countdown',number||'GO');audio.play(number?'count':'start');}if(!countdown){$('#countdown').hidden=true;running=true;accumulator=0;saveTimer=0;announce('Go');}}
  else if(running){
    accumulator+=delta;
    while(accumulator>=1000/30&&running){
      if(pending.length>=60){running=false;clearInput();showOverlay('Saving your run','Waiting for your connection to catch up.','Resume');break;}
      previous=structuredClone(predicted);const bits=controls();pending.push(bits);step(predicted,bits);input.stepped(previous,predicted);renderer.tick(predicted);
      for(const e of feedback(previous,predicted)){renderer.event(e);audio.play(e.type);if(e.label)toast(e.label);if(e.type==='wave'&&predicted.specials===previous.specials)toast((id==='neon-coil'||id==='drift-run'?'Pace ':'Wave ')+e.value);if(e.type==='damage'&&!predicted.over)toast(predicted.lives+' lives left');}
      accumulator-=1000/30;if(predicted.draft){void showPerks();break;}if(predicted.over){void finish();break;}
    }
    saveTimer+=delta;if(saveTimer>=1000){saveTimer=0;void flush().catch(()=>{});}
  }
  if(noticeTime>0){noticeTime-=delta;if(noticeTime<=0)$('#notice').hidden=true;}
  renderer.draw(predicted,previous,accumulator/(1000/30),delta,ratio,{running,reduced:motion.matches,low:quality==='low'||ratio<=1});
  updateHud();
}
showOverlay(config.title,'Connecting to your saved Myelin session…','Connecting…',true);busy=true;refreshButtons();void boot().finally(()=>{busy=false;refreshButtons();});
startRenderLoop(frame,{active:()=>running||countdown>0});
