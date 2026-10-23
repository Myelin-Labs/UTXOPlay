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
const dom=new JSDOM(readFileSync(root+'/games/sling/web/index.html','utf8'),{pretendToBeVisual:true,url:base+'/games/sling/'});
const {window}=dom,errors=[];
window.addEventListener('error',e=>errors.push(e.error));
const bitmaps={};
for(const name of ['islands','characters'])bitmaps[`/games/sling/assets/${name}.webp`]=await loadImage(root+`/games/sling/web/assets/${name}.webp`);
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
let failed=false,hold=false,release;
globalThis.fetch=async(url,options={})=>{
 if(String(url).endsWith('/action')&&failed){failed=false;throw Error('Test interrupted connection');}
 const response=await realFetch(new URL(url,base),{...options,headers:{...options.headers,Origin:base,Cookie:cookie}});
 if(String(url).endsWith('/action')&&hold)await new Promise(r=>release=r);
 return response;
};
let raf=new Map(),seq=0,time=0;
Object.defineProperty(globalThis,'performance',{value:{now:()=>time},configurable:true});
globalThis.requestAnimationFrame=cb=>{raf.set(++seq,cb);return seq;};globalThis.cancelAnimationFrame=id=>raf.delete(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function pump(frames){for(let i=0;i<frames;i++){time+=1000/60;const jobs=[...raf.values()];raf.clear();for(const cb of jobs)cb(time);}}
const $=s=>document.querySelector(s),state=async()=>await(await globalThis.fetch('/games/sling/api/state')).json();
await import(root+'/games/sling/web/app.js');
assert.equal($('#total-levels').textContent,'12');assert.equal($('#level-name').textContent,'First flight');
assert.equal($('#sound').textContent,'♫ Music off');
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
await pump(600);
let saved=await state();assert.equal(saved.game.inventory.burst,0);assert.equal(saved.session.actions,2);assert.equal(saved.game.last_power,'burst');
assert.equal($('[data-power="normal"]').getAttribute('aria-pressed'),'true');
await $('#replay-shot').onclick();await pump(600);assert.equal((await state()).session.block_hash,saved.session.block_hash);
await $('#verify').onclick();assert.match($('#verification').textContent,/Every state root matches/);
if(saved.game.won){await $('#continue').onclick();assert.equal($('#level-name').textContent,'Stone & sky');assert.equal((await state()).game.level,2);}
// Fourth miss offers a rescue; one click adds exactly one shot and returns to play.
await $('#new').onclick();$('#angle').value='0';$('#power').value='20';
for(let i=0;i<4;i++){await $('#launch').onclick();await pump(600);}
assert.equal($('#rescue-flight').hidden,false);assert.equal($('#level-result').hidden,false);
await $('#rescue-flight').onclick();assert.equal($('#level-result').hidden,true);assert.equal((await state()).game.shots,1);
await $('#launch').onclick();await pump(600);assert.equal($('#rescue-flight').hidden,true);
await $('#continue').onclick();assert.deepEqual((await state()).game.inventory,{burst:1,pierce:1,extra:1});
await pump(2);
mkdirSync(root+'/artifacts/skyward',{recursive:true});writeFileSync(root+'/artifacts/skyward/first-island.png',$('#world').native.toBuffer('image/png'));
assert.deepEqual(errors,[]);
console.log('Skyward: real UI item selection, extra flight, failed request, double launch guard, flight replay, signed replay, next island, last-shot rescue and retry passed.');
window.close();process.exit(0);
