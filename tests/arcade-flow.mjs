// Optional DOM integration harness. Run against an isolated real arcade + store.
// ARCADE_TEST_MODULES=/tmp/arcade-test/node_modules STORE_URL=http://127.0.0.1:19090 node tests/arcade-flow.mjs starfall
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(process.env.ARCADE_TEST_MODULES?resolve(process.env.ARCADE_TEST_MODULES,'../package.json'):import.meta.url);
const {JSDOM}=require('jsdom');
const kind=process.argv[2],root=resolve(import.meta.dirname,'..'),base=process.env.STORE_URL||'http://127.0.0.1:19090';
assert.ok(['prism-breaker','neon-coil','starfall','drift-run'].includes(kind));
const nativeFetch=globalThis.fetch;
const guest=await nativeFetch(base+'/api/guest',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
assert.equal(guest.status,200);const cookie=guest.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
const dom=new JSDOM(readFileSync(`${root}/games/${kind}/web/index.html`,'utf8'),{pretendToBeVisual:true,url:base+`/games/${kind}/`,runScripts:'outside-only'});
const {window}=dom,errors=[];
if(kind==='prism-breaker'){const {loadImage}=require('@napi-rs/canvas');const assetFile=url=>{const pathname=new URL(url,base).pathname;return pathname.startsWith('/assets/')?root+'/public'+pathname:root+pathname.replace('/games/prism-breaker/','/games/prism-breaker/web/');};globalThis.Image=class{async decode(){this.native=await loadImage(assetFile(this.src));}};window.HTMLImageElement.prototype.decode=async function(){this.native=await loadImage(assetFile(this.src));};}

window.addEventListener('error',e=>errors.push(e.error));
// Drawing is checked separately. This harness exercises actual UI flow and input.
const context=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(obj,key)=>key in obj?obj[key]:()=>{}});
window.HTMLCanvasElement.prototype.getContext=function(){return this.testContext??=context();};
window.HTMLCanvasElement.prototype.setPointerCapture=()=>{};
window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:600,height:600});
Object.defineProperty(window.HTMLCanvasElement.prototype,'clientWidth',{get:()=>600});
for(const name of ['document','location','localStorage','Event','KeyboardEvent','Blob'])globalThis[name]=window[name];
globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=window.addEventListener.bind(window);globalThis.dispatchEvent=window.dispatchEvent.bind(window);globalThis.removeEventListener=window.removeEventListener.bind(window);
let holdNew=false,holdAction=false,releaseNew,releaseAction,newCalls=0,failAction=false,failed=false,failState=false;
globalThis.fetch=async(url,options={})=>{
 if(String(url).endsWith('/state')&&failState){failState=false;throw Error('Test state unavailable');}
 if(String(url).endsWith('/new'))newCalls++;
 if(String(url).endsWith('/action')&&failAction){failed=true;failAction=false;throw Error('Test connection interrupted');}
 const response=await nativeFetch(new URL(url,window.location.href),{...options,headers:{...options.headers,Origin:base,Cookie:cookie}});
 if(String(url).endsWith('/new')&&holdNew)await new Promise(r=>releaseNew=r);
 if(String(url).endsWith('/action')&&holdAction)await new Promise(r=>releaseAction=r);
 return response;
};
let raf=new Map(),seq=0,time=1000;
globalThis.requestAnimationFrame=cb=>{const id=++seq;raf.set(id,cb);return id;};globalThis.cancelAnimationFrame=id=>raf.delete(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(test){for(let n=0;n<200&&!test();n++)await sleep(10);assert.ok(test(),'condition did not resolve');}
async function pump(frames){for(let i=0;i<frames;i++){time+=1000/60;const jobs=[...raf.values()];raf.clear();for(const cb of jobs)cb(time);if(i%15===0)await sleep(2);}}
const $=s=>document.querySelector(s),state=async()=>await (await globalThis.fetch('./api/state')).json();
function key(type,code){$('canvas').dispatchEvent(new window.KeyboardEvent(type,{bubbles:true,code}));}
window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
window.HTMLDialogElement.prototype.close=function(){this.open=false;};
window.eval(readFileSync(root+'/public/game-shell.js','utf8'));window.eval(readFileSync(root+'/public/game-overlay.js','utf8'));window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await import(`${root}/games/arcade/web/app.js`);
await until(()=>!$('#launch').disabled);assert.equal($('#overlay').dataset.art,'true');
if(kind==='prism-breaker'){assert.equal($('#prism-lens').getAttribute('aria-pressed'),'true');$('#prism-lens').click();assert.equal($('#prism-lens').getAttribute('aria-pressed'),'false');$('#prism-lens').click();assert.equal($('#prism-lens').getAttribute('aria-pressed'),'true');assert.equal(document.querySelectorAll('#lives img').length,3);}

// Every ability is scene-owned, and even a fast pointer tap must enter the tape.
assert.ok($('.game-surface').contains($('.signature-mechanic')));
assert.ok($('.game-surface').contains($('.signature-actions')));
if(kind==='prism-breaker'){
 await $('#launch').onclick();await pump(125);
 const bend=$('.signature-actions [data-input="4"]');
 const pointer=(type)=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:42});bend.dispatchEvent(e);};
 bend.setPointerCapture=()=>{};pointer('pointerdown');pointer('pointerup');await pump(4);await $('#pause').onclick();
 assert.equal((await state()).game.refractions,1,'tap survives pointer release before simulation');
}
// Holding a direction during countdown must affect the first simulation tick.
await $('#launch').onclick();key('keydown',kind==='neon-coil'?'KeyW':'KeyA');await pump(130);key('keyup',kind==='neon-coil'?'KeyW':'KeyA');
assert.equal($('#overlay').hidden,true);assert.equal($('#countdown').hidden,true);
$('.game-menu-toggle').click();assert.equal($('#game-menu').open,true);await until(()=>$('#pause').textContent==='Resume');
$('#game-menu .game-menu-close').click();assert.equal($('#game-menu').open,false);
await until(()=>$('#launch').disabled===false);let saved=await state();assert.ok(saved.game.tick>0);
if(kind==='neon-coil')assert.ok(saved.game.trail[0][1]<12);else assert.ok(saved.game.x<(kind==='drift-run'?1:500));
if(kind==='starfall')assert.ok(saved.game.bodies.some(b=>b.tag===2),'auto fire must produce real input tape shots');
if(kind==='starfall'){
 $('#autofire').click();assert.equal($('#autofire').getAttribute('aria-pressed'),'false');await $('#launch').onclick();await pump(140);await $('#pause').onclick();saved=await state();assert.equal(saved.game.cooldown,0,'manual mode must stop sending automatic fire');$('#autofire').click();
}
const pausedTick=saved.game.tick;let hudWrites=0;const observer=new window.MutationObserver(records=>hudWrites+=records.length);observer.observe($('#lives'),{attributes:true});await pump(60);observer.disconnect();assert.equal(hudWrites,0,'idle HUD must not rewrite unchanged attributes');assert.equal((await state()).game.tick,pausedTick);
await $('#replay').onclick();assert.match($('#status').textContent,/Replay verified/);
// Cancel is safe; rapid clicks on confirmation create exactly one session.
await $('#restart').onclick();assert.equal($('#cancel-restart').hidden,false);assert.equal(newCalls,0);
$('#cancel-restart').click();await until(()=>!$('#launch').disabled);await pump(125);await $('#pause').onclick();assert.equal((await state()).session.id,saved.session.id);
await $('#restart').onclick();holdNew=true;const start=$('#launch').onclick();await until(()=>!!releaseNew);
await $('#launch').onclick();assert.equal(newCalls,1);window.dispatchEvent(new window.Event('blur'));releaseNew();holdNew=false;await start;
assert.equal($('#overlay').hidden,false);assert.equal($('#countdown').hidden,true);assert.equal((await state()).game.tick,0,'a delayed response cannot resume in the background');
// Pausing with a save in flight must not allow an async resume after blur.
await $('#launch').onclick();holdAction=true;await pump(180);await until(()=>!!releaseAction);
const pausing=$('#pause').onclick();const resuming=$('#launch').onclick();window.dispatchEvent(new window.Event('blur'));holdAction=false;releaseAction();await pausing;await resuming;
assert.equal($('#overlay').hidden,false);assert.equal($('#countdown').hidden,true);
// A dropped save pauses and recovers the confirmed state without a stuck button.
await $('#launch').onclick();failAction=true;await pump(180);await until(()=>failed&&$('#overlay-title').textContent==='Connection paused');assert.equal($('#launch').disabled,false);
assert.equal($('#countdown').hidden,true);await $('#replay').onclick();assert.match($('#status').textContent,/Replay verified/);
// If both the action and recovery read fail, one reconnect click starts play.
await $('#launch').onclick();failAction=true;failState=true;await pump(180);await until(()=>$('#launch').textContent==='Reconnect'&&!$('#launch').disabled);
await $('#launch').onclick();assert.equal($('#overlay').hidden,true);assert.equal($('#countdown').hidden,false);await $('#pause').onclick();
// A completed snake run must show results before a slow final save returns.
if(kind==='neon-coil'){
 await $('#restart').onclick();await $('#launch').onclick();await pump(190);
 holdAction=true;await pump(65);await until(()=>!!releaseAction);await pump(70);
 assert.equal($('#overlay-title').textContent,'Run complete');assert.equal($('#run-stats').hidden,false);assert.equal($('#launch').disabled,true);
 holdAction=false;releaseAction();await until(()=>!$('#launch').disabled);assert.equal($('#launch').textContent,'Play again');
}
assert.deepEqual(errors,[]);
console.log(`${kind}: countdown input, pause, replay, cancel restart, duplicate-click guard, delayed request/blur, network recovery and single-click reconnect passed`);
window.close();
