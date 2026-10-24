// Isolated real-runtime UI check; optional jsdom + @napi-rs/canvas dependencies.
// ARCADE_TEST_MODULES=/tmp/utxoplay-render-check/node_modules STORE_URL=http://127.0.0.1:19092 node tests/skyward-flow.mjs
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(process.env.ARCADE_TEST_MODULES?resolve(process.env.ARCADE_TEST_MODULES,'../package.json'):import.meta.url);
const {JSDOM}=require('jsdom'),{createCanvas,loadImage}=require('@napi-rs/canvas');
const root=resolve(import.meta.dirname,'..'),base=process.env.STORE_URL||'http://127.0.0.1:19092';
const realFetch=globalThis.fetch;
const guest=await realFetch(base+'/api/guest',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});
assert.equal(guest.status,200);const cookie=guest.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
const dom=new JSDOM(readFileSync(root+'/games/sling/web/index.html','utf8'),{pretendToBeVisual:true,url:base+'/games/sling/',runScripts:'outside-only'});
const {window}=dom,errors=[];
window.addEventListener('error',e=>errors.push(e.error));
const bitmaps={};
for(const name of ['garden-worlds','garden-sprites'])bitmaps[`/games/sling/assets/${name}.webp`]=await loadImage(root+`/games/sling/web/assets/${name}.webp`);
globalThis.Image=class {set src(src){this.native=bitmaps[src];this.width=this.naturalWidth=this.native.width;this.height=this.native.height;this.complete=true;queueMicrotask(()=>this.onload?.());}};
window.HTMLCanvasElement.prototype.getContext=function(){
 if(this.testContext)return this.testContext;
 this.native=createCanvas(this.width,this.height);const context=this.native.getContext('2d');
 return this.testContext=new Proxy(context,{get:(o,k)=>k==='drawImage'?(img,...args)=>o.drawImage(img.native??img,...args):typeof o[k]==='function'?o[k].bind(o):o[k],set:(o,k,v)=>{o[k]=v;return true;}});
};
window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1100,height:560});
window.HTMLCanvasElement.prototype.setPointerCapture=()=>{};window.HTMLCanvasElement.prototype.hasPointerCapture=()=>false;
for(const name of ['document','localStorage','Event','CustomEvent','KeyboardEvent'])globalThis[name]=window[name];
globalThis.window=window;globalThis.matchMedia=()=>({matches:false});globalThis.addEventListener=window.addEventListener.bind(window);globalThis.removeEventListener=window.removeEventListener.bind(window);
// Audio lifecycle is checked independently; this test keeps the player's saved mute.
localStorage.setItem('skyward:audio',JSON.stringify({enabled:false,volume:0.3}));
globalThis.Audio=class extends EventTarget{play(){return Promise.resolve();}pause(){}};
let failed=false,hold=false,release,dropCommittedBuy=false,failRecovery=false,rejectReplay=false;
globalThis.fetch=async(url,options={})=>{
 if(String(url).endsWith('/replay')&&rejectReplay)return new Response(JSON.stringify({verified:false,frames:999}),{status:200});
 if(String(url).endsWith('/state')&&failRecovery){failRecovery=false;throw Error('Recovery offline');}
 if(String(url).endsWith('/action')&&failed){failed=false;throw Error('Test interrupted connection');}
 const response=await realFetch(new URL(url,base),{...options,headers:{...options.headers,Origin:base,Cookie:cookie}});
 if(String(url).endsWith('/action')&&dropCommittedBuy&&JSON.parse(options.body).action.type==='buy'){dropCommittedBuy=false;throw Error('Lost purchase response');}
 if(String(url).endsWith('/action')&&hold)await new Promise(r=>release=r);
 return response;
};
let raf=new Map(),seq=0,time=0;
Object.defineProperty(globalThis,'performance',{value:{now:()=>time},configurable:true});
globalThis.requestAnimationFrame=cb=>{raf.set(++seq,cb);return seq;};globalThis.cancelAnimationFrame=id=>raf.delete(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function pump(frames){for(let i=0;i<frames;i++){time+=1000/60;const jobs=[...raf.values()];raf.clear();for(const cb of jobs)cb(time);}}
const $=s=>document.querySelector(s),state=async()=>await(await globalThis.fetch('/games/sling/api/state')).json();
window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
window.HTMLDialogElement.prototype.close=function(){this.open=false;};
window.eval(readFileSync(root+'/public/game-shell.js','utf8'));window.eval(readFileSync(root+'/public/game-overlay.js','utf8'));window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
await import(root+'/games/sling/web/app.js');
$('.game-menu-toggle').click();assert.equal($('#game-menu').open,true);
$('#game-menu .game-menu-close').click();assert.equal($('#game-menu').open,false);
assert.equal($('#total-levels').textContent,'12');assert.equal($('#level-name').textContent,'First flight');
assert.equal($('#sound').textContent,'♫ Music off');
// Tap, cancellation and a second finger cannot spend a flight.
const {viewport}=await import(root+'/games/sling/web/viewport.mjs');
const view=viewport(1100,560,'sling'),pointer=(id,x=180,y=360)=>({button:0,pointerId:id,clientX:view.x+x*view.scale,clientY:view.y+y*view.scale});
const initial=(await state()).session.block_hash;
$('#world').onpointerdown(pointer(1));await $('#world').onpointerup(pointer(1));
$('#world').onpointerdown(pointer(1));$('#world').onpointermove(pointer(1,75,410));await $('#world').onpointerup(pointer(2,75,410));
$('#world').onpointercancel(pointer(1));await $('#world').onpointerup(pointer(1,75,410));
assert.equal((await state()).session.block_hash,initial,'cancelled/tap/multi-touch gestures are inert');

$('[data-power="burst"]').click();await $('#extra-flight').onclick();
assert.equal((await state()).game.shots,5);assert.equal($('#extra-flight').disabled,true);
assert.equal($('[data-power="burst"]').getAttribute('aria-pressed'),'true');
const before=await state();
// A rejected network request cannot consume the selected item.
failed=true;await $('#launch').onclick();assert.deepEqual((await state()).game.inventory,before.game.inventory);
assert.equal($('[data-power="burst"]').getAttribute('aria-pressed'),'true');
// Guard against double launch while awaiting the authoritative response.
hold=true;const firing=$('#launch').onclick();for(let i=0;i<100&&!release;i++)await sleep(10);assert.ok(release);
await $('#launch').onclick();hold=false;release();await firing;
// Opening the overlay pauses playback, and closing it does not jump ahead.
await pump(2);$('.game-menu-toggle').click();
await pump(900);assert.equal($('#skip-flight').hidden,false,'flight remains paused under menu');
$('#game-menu .game-menu-close').click();await pump(1);
assert.equal($('#skip-flight').hidden,false,'resume preserves playback position');
$('#skip-flight').onclick();await pump(2);
assert.equal($('#skip-flight').hidden,true,'skip finishes presentation only');
let saved=await state();assert.equal(saved.game.inventory.burst,0);assert.equal(saved.session.actions,2);assert.equal(saved.game.last_power,'burst');
assert.equal($('[data-power="normal"]').getAttribute('aria-pressed'),'true');
await $('#replay-shot').onclick();await pump(600);assert.equal((await state()).session.block_hash,saved.session.block_hash);
await $('#verify').onclick();assert.match($('#verification').textContent,/Every state root matches/);
rejectReplay=true;await $('#verify').onclick();assert.match($('#verification').textContent,/Verification failed/);rejectReplay=false;
if(saved.game.won){await $('#continue').onclick();assert.equal($('#level-name').textContent,'Stone & sky');assert.equal((await state()).game.level,2);}
// Earn coins through real play, then buy inside the same game menu.
await $('#new').onclick();$('#cancel-new').click();assert.equal((await state()).session.id,saved.session.id,'cancel new campaign preserves save');
await $('#new').onclick();await $('#new').onclick();
$('#shop-open').click();assert.equal($('#game-menu').dataset.view,'items');
assert.equal($('[data-buy="burst"]').disabled,true,'zero balance cannot buy');
$('#game-menu .game-menu-close').click();
// Use the authored solution through the authoritative API, then let polling/UI refresh on a normal action.
let seed=await state();
await globalThis.fetch('/games/sling/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:seed.session.id,expected_block:seed.session.block_hash,action:{type:'launch',dx:-116,dy:16}})});
// A stale action must recover the saved state without consuming another item.
await $('#launch').onclick();assert.equal($('#continue').textContent,'Next island →');
await $('#continue').onclick();assert.ok((await state()).game.coins>=12);
$('#shop-open').click();assert.equal($('#game-menu').open,true);assert.equal($('#item-store').hidden,false);
const walletBefore=await state();release=undefined;hold=true;
const buying=$('[data-buy="burst"]').onclick();for(let i=0;i<100&&!release;i++)await sleep(10);
await $('[data-buy="burst"]').onclick();hold=false;release();await buying;
const bought=await state();assert.equal(bought.game.coins,walletBefore.game.coins-12);assert.equal(bought.game.inventory.burst,2);assert.equal(bought.session.actions,walletBefore.session.actions+1);
assert.match($('#shop-feedback').textContent,/added/);assert.equal($('#game-menu').open,true);
// Response loss after a committed purchase recovers from the signed state, never retries the debit.
dropCommittedBuy=true;failRecovery=true;await $('[data-buy="extra"]').onclick();
assert.equal($('#shop-reconnect').hidden,false);assert.equal($('#launch').disabled,true);assert.equal($('[data-buy="burst"]').disabled,true);
await $('#shop-reconnect').onclick();assert.equal($('#shop-reconnect').hidden,true);
let recovered=await state();assert.equal(recovered.game.coins,bought.game.coins-8);assert.equal(recovered.game.inventory.extra,2);assert.match($('#shop-feedback').textContent,/restored/);
$('[data-equip="burst"]').click();assert.equal($('#game-menu').open,false);
assert.equal($('[data-equip="burst"]').getAttribute('aria-pressed'),'true');
await $('#launch').onclick();await pump(600);assert.equal((await state()).game.inventory.burst,1);
$('#shop-open').click();await $('#verify').onclick();assert.match($('#verification').textContent,/Every state root matches/);
$('#game-menu .game-menu-close').click();

// Fourth miss offers a rescue; one click adds exactly one shot and returns to play.
await $('#new').onclick();await $('#new').onclick();$('#angle').value='0';$('#power').value='20';
for(let i=0;i<4;i++){await $('#launch').onclick();await pump(600);}
assert.equal($('#rescue-flight').hidden,false);assert.equal($('#level-result').hidden,false);
await $('#rescue-flight').onclick();assert.equal($('#level-result').hidden,true);assert.equal((await state()).game.shots,1);
await $('#launch').onclick();await pump(600);assert.equal($('#rescue-flight').hidden,true);
await $('#continue').onclick();assert.deepEqual((await state()).game.inventory,{burst:1,pierce:1,extra:1});
// Complete all twelve islands through the actual pointer controller, using native solutions.
const solutions=JSON.parse(readFileSync(root+'/tests/skyward-solutions.json','utf8'));
for(let level=1;level<=12;level++){
 assert.equal((await state()).game.level,level);
 for(const [dx,dy] of solutions[level]){
  $('#world').onpointerdown(pointer(71));
  $('#world').onpointermove(pointer(71,180+dx,360+dy));
  await $('#world').onpointerup(pointer(71,180+dx,360+dy));
  $('#skip-flight').onclick();await pump(2);
 }
 assert.equal((await state()).game.won,true,'pointer campaign island '+level);
 assert.equal($('#level-result').hidden,false);
 if(level<12)await $('#continue').onclick();
}
await $('#verify').onclick();assert.match($('#verification').textContent,/Every state root matches/);
await pump(2);
mkdirSync(root+'/artifacts/skyward',{recursive:true});writeFileSync(root+'/artifacts/skyward/first-island.png',$('#world').native.toBuffer('image/png'));
assert.deepEqual(errors,[]);
console.log('Skyward: earn/buy/equip, duplicate purchase guard, committed-response loss and reconnect, reset cancellation, pointer ownership/tap cancellation, menu pause/resume, skip flight, failed verification, item use, twelve-island pointer campaign, signed replay, next island and rescue passed.');
window.close();process.exit(0);
