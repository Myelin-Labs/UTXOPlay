const $=s=>document.querySelector(s), canvas=$('#arena'), ctx=canvas.getContext('2d');
let room=null,busy=false,previous=null,current=null,received=0,map,images={},noticeTimer,sequence=Date.now(),lastPoll=0,lastInput=0,mouse={x:0,y:0,active:false},camera={x:1100,y:650},audio;
const keys=new Set();const input={direction:0,x:200,y:0,jump:0,fire:0,hook:0,weapon:2};
const colors=['#d3ed8c','#f5a785'];let sound=false,jumpUntil=0;
function notice(text){$('#notice').textContent=text;$('#notice').classList.remove('hidden');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').classList.add('hidden'),4500);}
async function api(body){const r=await fetch('/games/teeworlds/api/'+(body?'action':'state'),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error||'Connection failed');return data;}
function setRoom(next){const old=room;room=next;
 if(next?.state&&next.state.tick!==current?.tick){previous=current;current=next.state;received=performance.now();}
 if(next?.id!==old?.id){previous=null;current=next?.state||null;input.fire=0;input.hook=0;sequence=Date.now();}
 const state=next?.status;document.body.classList.toggle('playing',state==='running');
 $('#lobby').classList.toggle('hidden',!!next);$('#waiting').classList.toggle('hidden',state!=='waiting');$('#playing-hud').classList.toggle('hidden',state!=='running');
 $('#result').classList.toggle('hidden',!next||['waiting','running'].includes(state));
 $('#match-label').textContent=state==='running'?(next.mode==='practice'?'PRACTICE · YOU VS BOT':'PRIVATE DUEL'):'GRASSLAND ARENA';
 $('#timer').textContent=next?new Date(Math.max(0,(next.maxTicks-next.tick)/50)*1000).toISOString().slice(14,19):'01:00';
 if(state==='waiting')$('#invite-code').textContent=next.id;
 if(next&&!['waiting','running'].includes(state)){
  $('#result-label').textContent=state==='sealing'?'CHECKING THE REPLAY':state==='finished'?'ROUND COMPLETE':'MATCH INTERRUPTED';
  const players=next.state?.players||[];const me=players.find(p=>p.id===next.slot),opponent=players.find(p=>p.id!==next.slot);
  $('#result-title').textContent=state==='finished'?(me?.score>opponent?.score?'Nicely played.':me?.score===opponent?.score?'An even match.':'One more round?'):state==='sealing'?'Good game.':"Let’s try again.";
  $('#result-detail').textContent=next.error||(state==='sealing'?'Replaying the full match and sealing its Myelin record…':'Every jump, hook, and shot is saved in your match replay.');
  $('#scores').replaceChildren(...players.map(p=>{const el=document.createElement('div');el.textContent=p.id===next.slot?'YOU':next.mode==='practice'?'BOT':'OPPONENT';const score=document.createElement('strong');score.textContent=p.score;el.append(score);return el;}));
  $('#verification').textContent=next.proof?.verified?'✓ Native replay verified · Myelin session signed\n'+next.proof.state_root.slice(0,24)+'…':state==='sealing'?'Verification in progress. This may take a moment.':'No verified result was issued for this match.';
  $('#export').classList.toggle('hidden',!next.proof?.verified);
 }
}
async function action(body){if(busy)return;busy=true;for(const b of document.querySelectorAll('.actions button,#join'))b.disabled=true;try{setRoom((await api(body)).room);if(room?.status==='running')canvas.focus();}catch(e){notice(e.message);}finally{busy=false;for(const b of document.querySelectorAll('.actions button,#join'))b.disabled=false;}}
$('#practice').onclick=()=>action({type:'create',mode:'practice'});$('#create').onclick=()=>action({type:'create',mode:'duel'});
$('#join').onclick=()=>action({type:'join',room:$('#room-code').value.trim().toLowerCase()});
for(const b of document.querySelectorAll('.leave'))b.onclick=()=>action({type:'leave'});
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.id);notice('Room code copied. Send it to a friend.');}catch{notice('Select the room code above to copy it.');}};
$('#help').onclick=()=>$('#help-dialog').showModal();$('#close-help').onclick=()=>$('#help-dialog').close();
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',String(sound));if(sound){audio ||=new AudioContext();audio.resume();}};
function tone(freq=200){if(!sound||!audio)return;const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.setValueAtTime(freq,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(60,audio.currentTime+.08);gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.09);osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+.1);}
function fire(on){if((input.fire&1)!==Number(on)){input.fire=(input.fire+1)&63;if(on)tone();}}
function reset(){keys.clear();input.direction=0;input.jump=0;input.hook=0;fire(false);}
function key(event,on){if(room?.status!=='running'||event.target.tagName==='INPUT')return;if(['KeyA','KeyD','ArrowLeft','ArrowRight','Space','KeyW','Digit1','Digit2','Digit3','Digit4','Digit5'].includes(event.code)){event.preventDefault();if(on){keys.add(event.code);if(event.code==='Space'||event.code==='KeyW')jumpUntil=Date.now()+150;}else keys.delete(event.code);if(on&&event.code.startsWith('Digit'))input.weapon=Number(event.code.slice(-1));}}
addEventListener('keydown',e=>key(e,true));addEventListener('keyup',e=>key(e,false));addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function pointer(e){const rect=canvas.getBoundingClientRect();mouse={x:e.clientX-rect.left,y:e.clientY-rect.top,active:true};}
canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',e=>{pointer(e);if(room?.status!=='running')return;canvas.focus();canvas.setPointerCapture(e.pointerId);if(e.pointerType!=='touch'){if(e.button===2)input.hook=1;else if(e.button===0)fire(true);}});
canvas.addEventListener('pointerup',e=>{if(e.button===2)input.hook=0;else fire(false);});canvas.addEventListener('pointercancel',reset);
for(const b of document.querySelectorAll('.touch-controls button')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);if(b.dataset.key){keys.add(b.dataset.key);if(b.dataset.key==='Space')jumpUntil=Date.now()+150;}else if(b.dataset.control==='fire')fire(true);else input.hook=1;};b.onpointerup=b.onpointercancel=e=>{e.preventDefault();if(b.dataset.key)keys.delete(b.dataset.key);else if(b.dataset.control==='fire')fire(false);else input.hook=0;};}
async function poll(){try{setRoom((await api()).room);}catch(e){if(Date.now()-lastPoll>6000){notice(e.message);lastPoll=Date.now();}}setTimeout(poll,room?.status==='running'?100:1000);}
let sending=false;setInterval(async()=>{if(sending||room?.status!=='running'||document.hidden)return;input.direction=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));input.jump=Number(keys.has('Space')||keys.has('KeyW')||Date.now()<jumpUntil);
 const me=current?.items.find(i=>i[0]===map.types.character&&i[1]===room.slot)?.[2];
 if(me&&mouse.active){const w=canvas.clientWidth,h=canvas.clientHeight,scale=zoom();input.x=Math.round(Math.max(-2000,Math.min(2000,(mouse.x-w/2)/scale+camera.x-me[1])));input.y=Math.round(Math.max(-2000,Math.min(2000,(mouse.y-h/2)/scale+camera.y-me[2])));if(!input.x&&!input.y)input.x=1;}
 sending=true;const start=performance.now();try{await api({type:'input',room:room.id,input:{...input,seq:++sequence}});$('#network').textContent=Math.round(performance.now()-start)+' ms · 50 Hz';}catch(e){if(performance.now()-lastInput>5000){notice(e.message);lastInput=performance.now();}}finally{sending=false;}},80);
function zoom(){return canvas.clientWidth<650?.85:1.12;}
function sprite(img,sx,sy,sw,sh,x,y,w,h){if(img?.complete)ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
const weaponSprites=[[2,1,4,3],[2,4,4,2],[2,6,8,2],[2,8,7,2],[2,12,7,3]];
function weapon(kind,x,y,angle,size=42){const s=weaponSprites[Math.max(0,Math.min(4,kind))];ctx.save();ctx.translate(x,y);ctx.rotate(angle);if(Math.cos(angle)<0)ctx.scale(1,-1);sprite(images.game,...s.map(n=>n*32),-8,-size*s[3]/s[2]/2,size,size*s[3]/s[2]);ctx.restore();}
function tee(x,y,color,angle,walk,kind=1,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 const body=images.body,feet=images.feet,eyes=images.eyes;
 const step=Math.sin(walk)*5;
 ctx.fillStyle='#071b1c55';ctx.beginPath();ctx.ellipse(0,17,20,5,0,0,Math.PI*2);ctx.fill();
 const fw=feet.width/2,fh=feet.height;for(const [fx,fy]of [[-13,9+step],[3,9-step]]){sprite(feet,fw,0,fw,fh,fx-2,fy-2,28,15);sprite(feet,0,0,fw,fh,fx,fy,24,12);}
 const bw=body.width/2,bh=body.height/2;sprite(body,0,0,bw,bh,-25,-28,50,50);
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,-3,18,0,Math.PI*2);ctx.fill();
 sprite(body,0,bh,bw,bh,-24,-27,48,48);
 const ex=Math.cos(angle)*5,ey=Math.sin(angle)*4;sprite(eyes,0,0,eyes.width/2,eyes.height/4,-12+ex,-13+ey,26,20);
 weapon(kind,10*Math.cos(angle),2+9*Math.sin(angle),angle,36);
 ctx.restore();}
function background(w,h,now){const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#142d2b');g.addColorStop(.6,'#3b6650');g.addColorStop(1,'#91a36b');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#dce8a918';ctx.beginPath();ctx.arc(w*.78,h*.2,65,0,Math.PI*2);ctx.fill();
 for(let layer=0;layer<3;layer++){ctx.fillStyle=['#20473b','#285442','#31593f'][layer];ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w+30;x+=30){const world=x+camera.x*(.08+layer*.07);ctx.lineTo(x,h*(.42+layer*.13)+Math.sin(world*.004+layer)*55+Math.sin(world*.013)*20);}ctx.lineTo(w,h);ctx.fill();}
 for(let i=0;i<20;i++){const x=((i*197-camera.x*.15)%w+w)%w,y=70+(i*83)%Math.max(100,h-90);ctx.fillStyle='#e2eda226';ctx.beginPath();ctx.arc(x,y+Math.sin(now/1800+i)*12,1.3,0,7);ctx.fill();}}
function render(now){const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);background(w,h,now);
 const state=current,scale=zoom();let chars=state?.items.filter(i=>i[0]===map?.types.character).map(i=>[i[0],i[1],[...i[2]]])||[];
 for(const c of chars){const old=previous?.items.find(i=>i[0]===c[0]&&i[1]===c[1]);if(old){const t=Math.min(1,(now-received)/100);if(Math.hypot(c[2][1]-old[2][1],c[2][2]-old[2][2])<250){c[2][1]=old[2][1]+(c[2][1]-old[2][1])*t;c[2][2]=old[2][2]+(c[2][2]-old[2][2])*t;}}}
 const me=chars.find(i=>i[1]===room?.slot)?.[2];if(room&&me){camera.x+=(me[1]-camera.x)*.12;camera.y+=(me[2]-camera.y)*.1;}else if(!room){camera.x+=(1100-camera.x)*.02;camera.y+=(680-camera.y)*.02;}
 ctx.save();ctx.translate(w/2-camera.x*scale,h/2-camera.y*scale);ctx.scale(scale,scale);
 if(map){const minx=Math.max(0,Math.floor((camera.x-w/scale/2)/32)-1),maxx=Math.min(map.width,Math.ceil((camera.x+w/scale/2)/32)+1),miny=Math.max(0,Math.floor((camera.y-h/scale/2)/32)-1),maxy=Math.min(map.height,Math.ceil((camera.y+h/scale/2)/32)+1);
 for(let y=miny;y<maxy;y++)for(let x=minx;x<maxx;x++){const t=map.tiles[y*map.width+x];if(t!==1&&t!==3&&t!==2)continue;const px=x*32,py=y*32;if(t===2){ctx.fillStyle='#b97053';ctx.beginPath();ctx.moveTo(px,py+32);ctx.lineTo(px+8,py+15);ctx.lineTo(px+16,py+32);ctx.lineTo(px+24,py+15);ctx.lineTo(px+32,py+32);ctx.fill();continue;}
 ctx.fillStyle=t===3?'#586c5b':(x+y)%3===0?'#384d35':'#30452f';ctx.fillRect(px,py,32,32);ctx.strokeStyle='#1d352840';ctx.strokeRect(px,py,32,32);
 const above=map.tiles[(y-1)*map.width+x];if(above!==1&&above!==3){ctx.fillStyle=t===3?'#91a69b':'#a4c675';ctx.fillRect(px,py,32,5);ctx.fillStyle=t===3?'#718e7e':'#749a56';ctx.fillRect(px,py+5,32,4);for(let k=0;k<4;k++){ctx.beginPath();ctx.moveTo(px+k*8,py);ctx.lineTo(px+k*8+3,py-4-(x+k)%5);ctx.lineTo(px+k*8+5,py);ctx.fill();}}
 }}
 if(state){for(const item of state.items){const d=item[2];if(item[0]===map.types.pickup){const bob=Math.sin(now/500+item[1])*.9;if(d[2]===0||d[2]===1){const sx=d[2]===0?21:15;sprite(images.game,sx*32,0,64,64,d[0]-14,d[1]-14+bob,28,28);}else{const kinds={2:3,3:2,4:4,6:1,7:0};weapon(kinds[d[2]]||0,d[0]-15,d[1]+bob,-.12,37);}}
 if(item[0]===map.types.laser){ctx.strokeStyle='#e5f9d6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(d[0],d[1]);ctx.lineTo(d[2],d[3]);ctx.stroke();}}
 for(const p of state.projectiles){ctx.fillStyle=p[2]===3?'#f2b866':'#f2edba';ctx.beginPath();ctx.arc(p[0],p[1],p[2]===3?6:3,0,7);ctx.fill();}
 for(const c of chars){const d=c[2];if(d[9]>0){ctx.strokeStyle='#dedbbc';ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(d[1],d[2]);ctx.lineTo(d[11],d[12]);ctx.stroke();ctx.fillStyle='#ede8c7';ctx.beginPath();ctx.arc(d[11],d[12],4,0,7);ctx.fill();}tee(d[1],d[2],colors[c[1]],d[5]/256,Math.abs(d[3])>100?now/90:0,d[18]);ctx.font='bold 9px Inter,Arial';ctx.textAlign='center';ctx.fillStyle=c[1]===room?.slot?'#e9f4c9':'#efc5ad';ctx.fillText(c[1]===room?.slot?'YOU':room?.mode==='practice'?'BOT':'PLAYER '+(c[1]+1),d[1],d[2]-40);}
 }else{tee(1310,590,'#d3ed8c',-.3,now/300,1,2.4);tee(1475,740,'#f5a785',-2.5,now/300+2,3,1.7);ctx.strokeStyle='#e7e4bc90';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(1310,590);ctx.lineTo(1460,375);ctx.stroke();}
 ctx.restore();if(room?.status==='running'){const d=me;$('#health').textContent=d?'♥'.repeat(d[15])+'\n'+'◆'.repeat(d[16]):'Respawning…';$('#weapon').textContent=d?['HAMMER','GUN','SHOTGUN','GRENADE','LASER','NINJA'][d[18]]+' · '+(d[17]<0?'∞':d[17]):'';$('#scoreboard').textContent=(state?.players||[]).map(p=>(p.id===room.slot?'YOU':room.mode==='practice'?'BOT':'P'+(p.id+1))+'  '+p.score).join('    ');}
 requestAnimationFrame(render);}
try{map=await (await fetch('assets/map.json')).json();await Promise.all(['body','feet','eyes','game'].map(name=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src='assets/'+name+'.png';images[name]=img;})));requestAnimationFrame(render);poll();}catch{notice('The arena assets could not load. Please reload.');}
