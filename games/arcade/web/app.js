import {createGame,step,kinds} from './engine.mjs';
const id=location.pathname.split('/')[2];
const config={
 'prism-breaker':{title:'Prism Breaker',label:'01 / REFRACTION LAB',accent:'#b7a2ff',intro:'Find the angle. Break the spectrum.',goal:'Clear the prism wall. Chain brick hits for a bigger multiplier. Three lives, endless waves.',keys:['←','→','A','D'],tip:'Move with the arrow keys, drag across the board, or hold the touch arrows. Keep the ball above your paddle.'},
 'neon-coil':{title:'Neon Coil',label:'02 / LIVING CIRCUIT',accent:'#84efba',intro:'A little hunger. A longer circuit.',goal:'Collect the glowing nodes. Grow your circuit without crossing yourself or touching the edge.',keys:['↑','←','↓','→'],tip:'Arrow keys or WASD to turn. Swipe on the board or use the direction buttons. The pace increases as you grow.'},
 'starfall':{title:'Starfall',label:'03 / ORBITAL DEFENCE',accent:'#7edaff',intro:'Hold the line. Light up the night.',goal:'Break through each descending formation. Dodge return fire and survive the next wave.',keys:['←','→','SPACE'],tip:'Move with A/D or arrows, hold Space to fire. On touch, drag to steer and fire, or use the buttons below.'},
 'drift-run':{title:'Drift Run',label:'04 / AFTER HOURS',accent:'#ffbc83',intro:'Three lanes. One way forward.',goal:'Slip between the barriers. Catch amber energy rings as the city rushes past.',keys:['←','→','A','D'],tip:'Tap left or right to change lanes. Swipe sideways on the road, or use the touch arrows. Stay clear of the coral barriers.'}
}[id];
if(!config||!kinds.includes(id))throw Error('Unknown arcade game');
const $=s=>document.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');
document.documentElement.style.setProperty('--accent',config.accent);document.title=config.title+' · UTXOPlay';
$('#title').textContent=config.title;$('#eyebrow').textContent=config.label;$('#intro').textContent=config.intro;$('#goal').textContent=config.goal;$('#controls').textContent=config.tip;
for(const key of config.keys){const k=document.createElement('kbd');k.textContent=key;$('#keys').append(k);}
for(const b of document.querySelectorAll('.touch button'))if((id!=='neon-coil'&&[4,8].includes(+b.dataset.input))||(id!=='starfall'&&+b.dataset.input===16))b.hidden=true;
let predicted=createGame(id),confirmed=null,pending=[],sending=null,running=false,loaded=false,keys=0,accumulator=0,last=0,saveTimer=0,muted=true,audio=null,particles=[],ballTrail=[],lastScore=0,stopping=false,pointerX=null,pointerHeld=false,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const status=t=>$('#status').textContent=t;
async function api(endpoint,body){const r=await fetch('./api/'+endpoint,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const v=await r.json();if(!r.ok)throw Error(v.error||'Game service unavailable');return v;}
function overlay(title,text,button){$('#overlay-title').textContent=title;$('#overlay-text').textContent=text;$('#launch').textContent=button;$('#overlay').hidden=false;}
function sound(freq=440){if(muted)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+.12);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.14);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.15);}catch{}}
function burst(x,y){if(reduced)return;for(let i=0;i<16;i++)particles.push({x,y,vx:Math.cos(i*2.4)*(2+i%5),vy:Math.sin(i*2.4)*(2+i%5),life:1});}
function controls(){let i=keys;if(pointerHeld&&pointerX!==null&&(id==='prism-breaker'||id==='starfall')){i&=~3;if(pointerX<predicted.x-12)i|=1;else if(pointerX>predicted.x+12)i|=2;if(id==='starfall')i|=16;}return i;}
async function flush(){
 if(sending)return sending;if(!pending.length||!confirmed)return;
 const tape=pending.splice(0,60),before=confirmed;
 const task=(async()=>{try{
  const result=await api('action',{session_id:before.session.id,expected_block:before.session.block_hash,action:{type:'ticks',inputs:tape}});
  confirmed=result;predicted=structuredClone(result.game);for(const i of pending)step(predicted,i);
  status(`Saved · ${result.session.actions} Myelin frames · ${result.game.score.toLocaleString()} points`);
 }catch(e){running=false;pending=[];try{confirmed=await api('state');predicted=structuredClone(confirmed.game);}catch{}overlay('Run paused',e.message+' Resume from your last confirmed save.','Resume');status('Sync interrupted. Your confirmed progress is safe.');throw e;}})();
 sending=task;try{await task;}finally{sending=null;}
}
async function saveAll(){while(sending||pending.length){if(sending)await sending;else await flush();}}
async function finish(){if(stopping)return;stopping=true;running=false;try{await saveAll();overlay('Run complete',`${confirmed.game.score.toLocaleString()} points · wave ${confirmed.game.level}. Your run is saved in Myelin.`,'Play again');sound(180);}catch{}finally{stopping=false;}}
async function boot(){try{confirmed=await api('state');predicted=structuredClone(confirmed.game);loaded=true;$('#launch').disabled=false;overlay(predicted.over?'Your last run':config.title,predicted.tick?`${predicted.score} points saved. ${predicted.over?'Ready for another run?':'Pick up where you left off.'}`:config.intro,predicted.over?'Play again':predicted.tick?'Continue run':'Start playing');status('Connected · Myelin v0.31 · private saved session');}catch(e){overlay('Connecting failed',e.message,'Retry connection');$('#launch').disabled=false;status('Unable to load your session.');}}
$('#launch').onclick=async()=>{if(stopping)return;$('#launch').disabled=true;try{if(!loaded){await boot();return;}await saveAll();if(predicted.over){confirmed=await api('new',{});predicted=structuredClone(confirmed.game);}keys=0;lastScore=predicted.score;running=true;accumulator=0;last=performance.now();$('#overlay').hidden=true;$('#pause').textContent='Pause';canvas.focus();sound(520);}catch(e){status(e.message);}finally{$('#launch').disabled=false;}};
async function pause(){if(!running)return;running=false;keys=0;pointerHeld=false;$('#pause').textContent='Resume';overlay('Take a breath','Your run is paused. Continue whenever you’re ready.','Resume');try{await saveAll();}catch{}}
$('#pause').onclick=()=>running?pause():$('#launch').click();
$('#restart').onclick=async()=>{if(stopping)return;if(!confirm('Start a new run? Your current run will end.'))return;running=false;keys=0;stopping=true;try{await saveAll();confirmed=await api('new',{});predicted=structuredClone(confirmed.game);overlay(config.title,config.intro,'Start playing');status('New Myelin session ready.');}catch(e){status(e.message);}finally{stopping=false;}};
$('#sound').onclick=()=>{muted=!muted;$('#sound').textContent=muted?'Sound off':'Sound on';$('#sound').setAttribute('aria-pressed',String(!muted));sound();};
$('#replay').onclick=async()=>{await pause();$('#replay').disabled=true;try{await saveAll();const v=await api('replay',{});status(`Replay verified · ${v.frames} signed frames · ${v.state_root?.slice(0,16)||'genesis'}`);}catch(e){status(e.message);}finally{$('#replay').disabled=false;}};
$('#export').onclick=async e=>{e.preventDefault();await pause();try{await saveAll();const v=await api('export');const u=URL.createObjectURL(new Blob([JSON.stringify(v,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=`${id}-myelin-session.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);}catch(err){status(err.message);}};
const mapping={ArrowLeft:1,a:1,A:1,ArrowRight:2,d:2,D:2,ArrowUp:4,w:4,W:4,ArrowDown:8,s:8,S:8,' ':16};
addEventListener('keydown',e=>{if(e.target.closest('button,a,input'))return;if(mapping[e.key]){e.preventDefault();keys|=mapping[e.key];}if(e.key==='p'||e.key==='Escape')pause();});addEventListener('keyup',e=>{if(mapping[e.key]){keys&=~mapping[e.key];e.preventDefault();}});
addEventListener('blur',()=>{keys=0;pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
for(const b of document.querySelectorAll('[data-input]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys|=+b.dataset.input;});for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{keys&=~(+b.dataset.input);});}
let startPoint=null;
canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);pointerHeld=true;startPoint=[e.clientX,e.clientY];pointerX=(e.clientX-canvas.getBoundingClientRect().left)/canvas.clientWidth*1000;});
canvas.addEventListener('pointermove',e=>{if(!pointerHeld)return;pointerX=(e.clientX-canvas.getBoundingClientRect().left)/canvas.clientWidth*1000;if(startPoint&&(id==='neon-coil'||id==='drift-run')){const dx=e.clientX-startPoint[0],dy=e.clientY-startPoint[1];if(Math.max(Math.abs(dx),Math.abs(dy))>18){keys=Math.abs(dx)>Math.abs(dy)?dx>0?2:1:dy>0?8:4;startPoint=[e.clientX,e.clientY];if(id==='drift-run')setTimeout(()=>{keys=0;},100);}}});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>{pointerHeld=false;startPoint=null;if(id==='drift-run')keys=0;});
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function line(x1,y1,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function glow(color,blur=15){ctx.shadowColor=color;ctx.shadowBlur=reduced?0:blur;}
function draw(t){
 const dpr=Math.min(devicePixelRatio||1,2),size=Math.round(canvas.clientWidth*dpr);if(canvas.width!==size){canvas.width=canvas.height=size;}ctx.setTransform(size/1000,0,0,size/1000,0,0);ctx.clearRect(0,0,1000,1000);
 const g=predicted;const bg=ctx.createLinearGradient(0,0,0,1000);bg.addColorStop(0,id==='drift-run'?'#21152e':'#0c1121');bg.addColorStop(1,'#070b16');ctx.fillStyle=bg;ctx.fillRect(0,0,1000,1000);
 if(id==='neon-coil'){
  for(let n=0;n<=20;n++){line(n*50,0,n*50,1000,'#172a2b');line(0,n*50,1000,n*50,'#172a2b');}
  glow('#8aefb5',24);circle(g.x*50+25,g.y*50+25,13+Math.sin(t/180)*2,'#c2ffe0');ctx.shadowBlur=0;
  g.trail.forEach((p,i)=>{round(p[0]*50+4,p[1]*50+4,42,42,12,i===0?'#dcffee':`hsl(${155+i*2} 58% ${Math.max(25,65-i*2)}%)`);});
  const h=g.trail[0];circle(h[0]*50+18,h[1]*50+18,4,'#153a32');circle(h[0]*50+33,h[1]*50+18,4,'#153a32');
 }else if(id==='prism-breaker'){
  for(let n=0;n<25;n++)line(0,n*45,1000,n*45,'#141b31');
  g.cells.forEach((v,n)=>{if(!v)return;const x=70+n%8*110,y=135+Math.floor(n/8)*48;const color=['#b8a0fb','#a099f6','#7ca8f7','#74c7dc','#80dcca','#d1eaa0'][Math.floor(n/8)];round(x-48,y-16,96,32,7,color);round(x-43,y-13,86,4,2,'#ffffff50');});
  const b=g.bodies[0];if(running&&!reduced){ballTrail.push([b.x,b.y]);if(ballTrail.length>12)ballTrail.shift();}ballTrail.forEach((p,i)=>circle(p[0],p[1],3+i*.6,`rgba(183,162,255,${i/40})`));glow('#b8a0ff',20);round(g.x-90,880,180,18,9,'#ded3ff');circle(b.x,b.y,12,'#fff');ctx.shadowBlur=0;
  if(g.combo>1){ctx.font='600 20px system-ui';ctx.fillStyle='#bba9e6';ctx.textAlign='center';ctx.fillText(`${g.combo} × COMBO`,500,600);}
 }else if(id==='starfall'){
  for(let i=0;i<65;i++){const x=(i*173+17)%1000,y=(i*237+(reduced?0:g.tick*(1+i%3)))%1000;circle(x,y,i%3===0?2:1,'#7c9cb177');}
  for(const b of g.bodies){if(b.tag===1){glow('#59c3d4',8);ctx.fillStyle=['#ac9bff','#87bfff','#6bd0d6','#87ddba'][Math.floor((b.y-110)/70)%4]||'#a89aff';ctx.beginPath();ctx.moveTo(b.x,b.y-22);ctx.lineTo(b.x+30,b.y-4);ctx.lineTo(b.x+20,b.y+19);ctx.lineTo(b.x,b.y+9);ctx.lineTo(b.x-20,b.y+19);ctx.lineTo(b.x-30,b.y-4);ctx.closePath();ctx.fill();ctx.shadowBlur=0;round(b.x-12,b.y-5,24,5,2,'#101c35');}else{glow(b.tag===2?'#9ee9ff':'#ff9d9d',12);round(b.x-3,b.y-12,6,24,3,b.tag===2?'#c9f4ff':'#ff8f9f');ctx.shadowBlur=0;}}
  ctx.save();ctx.translate(g.x,900);ctx.globalAlpha=g.vy>0&&g.tick%6<3?.35:1;glow('#80dfff',18);ctx.fillStyle='#aeeaff';ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(28,22);ctx.lineTo(0,12);ctx.lineTo(-28,22);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#8572ff';ctx.fillRect(-7,24,14,15+g.tick%12);ctx.restore();
 }else{
  const horizon=180;const road=(lane,y)=>{const depth=(y+100)/1100;return {x:500+(lane-1)*290*depth,y:horizon+depth*760,scale:depth};};
  glow('#df88b8',40);circle(500,160,80,'#dca2b4');ctx.shadowBlur=0;ctx.fillStyle='#0c1020';for(let n=0;n<18;n++){const x=n*60,h=40+(n*67)%170;ctx.fillRect(x,260-h,42,h);for(let k=0;k<3;k++)ctx.fillStyle='#a48eb01a',ctx.fillRect(x+8,270-h+k*20,6,8);ctx.fillStyle='#0c1020';}
  ctx.fillStyle='#101425';ctx.beginPath();ctx.moveTo(440,horizon);ctx.lineTo(560,horizon);ctx.lineTo(1000,1000);ctx.lineTo(0,1000);ctx.closePath();ctx.fill();
  for(let n=0;n<4;n++){line(500+(n-1.5)*30,horizon,500+(n-1.5)*340,1000,n===0||n===3?'#ba7197':'#534263',n===0||n===3?4:2);}
  for(let n=0;n<12;n++){const y=(n*95+g.tick*10)%1100,p=road(1,y);line(500-450*p.scale,p.y,500+450*p.scale,p.y,'#7d638021');}
  for(const b of [...g.bodies].sort((a,b)=>a.y-b.y)){const p=road(b.x,b.y);if(p.scale<0)continue;if(b.tag===1){round(p.x-75*p.scale,p.y-40*p.scale,150*p.scale,65*p.scale,8,'#df7b92');round(p.x-65*p.scale,p.y-35*p.scale,130*p.scale,9*p.scale,3,'#ffb5bc');}else{glow('#ffd289',18);ctx.strokeStyle='#ffd289';ctx.lineWidth=6*p.scale;ctx.beginPath();ctx.arc(p.x,p.y,25*p.scale,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}}
  const p=road(g.x,830);glow('#c2aeff',30);round(p.x-39,p.y-42,78,85,18,'#bda8fa');ctx.shadowBlur=0;round(p.x-28,p.y-25,56,22,8,'#433651');round(p.x-30,p.y+22,18,8,3,'#ffcfb0');round(p.x+12,p.y+22,18,8,3,'#ffcfb0');
 }
 if(g.score>lastScore){burst(id==='neon-coil'?g.trail[0][0]*50+25:500,id==='neon-coil'?g.trail[0][1]*50+25:450);sound(500+(g.score%300));}lastScore=g.score;
 particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.life-=.03;ctx.globalAlpha=Math.max(0,p.life);circle(p.x,p.y,3,config.accent);}ctx.globalAlpha=1;
 $('#score').textContent=g.score.toLocaleString();$('#level').textContent=String(g.level).padStart(2,'0');$('#lives').textContent='●'.repeat(g.lives)+'○'.repeat(3-g.lives);
}
function frame(t){
 const delta=last?Math.min(t-last,100):0;last=t;
 if(running){accumulator+=delta;while(accumulator>=1000/30&&running){if(pending.length>=60){running=false;overlay('Saving your run','Waiting for the server. Your last confirmed progress is safe.','Resume');break;}const input=controls();pending.push(input);step(predicted,input);accumulator-=1000/30;if(predicted.over){finish();break;}}saveTimer+=delta;if(saveTimer>=1000){saveTimer=0;flush().catch(()=>{});}}
 if(!document.hidden)draw(t);requestAnimationFrame(frame);
}
overlay(config.title,'Connecting to your saved Myelin session…','Connecting…');$('#launch').disabled=true;boot();requestAnimationFrame(frame);
