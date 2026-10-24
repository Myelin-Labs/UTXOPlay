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
window.eval(readFileSync(root+'/public/game-shell.js','utf8'));

const actions=JSON.parse(readFileSync(root+'/artifacts/prism/campaign-actions.json'));
let authority=await state();
for(const action of actions){if(action.type==='perk')break;authority=await(await globalThis.fetch('./api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:authority.session.id,expected_block:authority.session.block_hash,action})})).json();}
assert.equal(authority.game.draft,true);
let perkCalls=0,loseAck=process.env.LOSE_PERK_ACK==='1';const fetchBefore=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{const perk=options.body&&JSON.parse(options.body).action?.type==='perk';if(perk)perkCalls++;const response=await fetchBefore(url,options);if(perk&&loseAck){loseAck=false;throw Error('Lost acknowledgement after accepted perk');}return response;};
await import(`${root}/games/arcade/web/app.js`);
await until(()=>!$('#launch').disabled);$('#launch').click();await until(()=>!$('#prism-draft').hidden);
assert.equal(document.querySelectorAll('.perk-card').length,3);assert.equal($('#overlay').hidden,true);
const before=await state();await pump(120);assert.equal((await state()).game.tick,before.game.tick,'draft pauses physics');
holdAction=true;const button=$('.perk-card');button.click();button.click();await until(()=>!!releaseAction);assert.equal(perkCalls,1);assert.ok([...document.querySelectorAll('.perk-card')].every(b=>b.disabled));window.dispatchEvent(new window.Event('blur'));holdAction=false;releaseAction();await until(()=>$('#prism-draft').hidden&&!$('#launch').disabled);
const after=await state();assert.equal(after.game.level,2);assert.equal(after.game.perks.reduce((a,b)=>a+b),1);assert.equal($('#overlay').hidden,false);assert.equal($('#launch').textContent,'Enter sector');assert.equal(errors.length,0);
console.log('Perk DOM flow passed: real sector clear, paused draft, one signed upgrade, double-click guard, blur, '+(process.env.LOSE_PERK_ACK?'lost-ack recovery':'normal acknowledgement'));dom.window.close();
