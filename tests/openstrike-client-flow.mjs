// Exercise the shipped controller with a DOM and transport double. Geometry is
// verified separately in a real WebGL browser; this test does not simulate it.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import path from 'node:path';import {build} from 'esbuild';
const require=createRequire(process.env.ARCADE_TEST_MODULES?path.resolve(process.env.ARCADE_TEST_MODULES,'../package.json'):import.meta.url),{JSDOM}=require('jsdom');
const root=process.cwd(),html=readFileSync('games/openstrike/web/index.html','utf8');
const result=await build({entryPoints:['games/openstrike/client/main.mjs'],bundle:true,write:false,format:'iife',plugins:[{name:'test-world',setup(b){b.onLoad({filter:/client\/main\.mjs$/},args=>({contents:readFileSync(args.path,'utf8').replace('await boot();','void boot();'),loader:'js',resolveDir:path.dirname(args.path)}));b.onLoad({filter:/client\/scene\.mjs$/},()=>({contents:`import {Vector3,Euler} from 'three';export async function makeScene(){return {camera:{position:new Vector3(),rotation:new Euler(),lookAt(){}},enemy:{position:new Vector3(),rotation:new Euler()},gun:{},flash:{},renderer:{render(){},info:{render:{calls:0}}},resize(){},resolution(){},setQuality(){},shoot(){},animate(){},dispose(){}}}`,loader:'js',resolveDir:root}));b.onLoad({filter:/shared\/game-performance\.mjs$/},()=>({contents:`export function startRenderLoop(){return ()=>{}};export function setText(id,value){const e=document.getElementById(id);if(e)e.textContent=String(value)}`,loader:'js'}));}}]});
const dom=new JSDOM(html,{url:'http://localhost/games/openstrike/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.setPointerCapture=()=>{};
const room={id:'a'.repeat(24),mode:'practice',difficulty:'rookie',status:'running',slot:0,tick:10,maxTicks:5760,state:{players:[0,1].map(slot=>({position:[0,0,slot?-260:260],velocity:[0,0,0],alive:true,health:100,ammo:30,reserve:90,last_input_sequence:0,reloading:false}))},events:[]};
let socket;class Socket{static OPEN=1;readyState=1;bufferedAmount=0;messages=[];constructor(){socket=this;queueMicrotask(()=>this.onopen?.());}send(raw){this.messages.push(JSON.parse(raw));}close(){this.readyState=3;this.onclose?.();}}
w.WebSocket=Socket;w.fetch=async url=>({ok:true,json:async()=>url==='arena.json'?JSON.parse(readFileSync('games/openstrike/web/arena.json')):{room:structuredClone(room)}});
w.eval(result.outputFiles[0].text);const settle=()=>new Promise(resolve=>setTimeout(resolve,25));
const input=()=>socket.messages.filter(x=>x.type==='input').at(-1)?.input;
const pointer=(type,id=1,x=0,y=0)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:id,clientX:x,clientY:y});return e;};
try{
 await settle();const d=w.document;d.getElementById('resume').click();await settle();assert.equal(d.getElementById('panel').hidden,true);
 d.getElementById('arena').dispatchEvent(new w.MouseEvent('mousedown',{button:0,bubbles:true}));w.dispatchEvent(new w.MouseEvent('mouseup'));assert.equal(input().fire,true,'a quick click must survive until a native tick');
 w.dispatchEvent(new w.Event('blur'));assert.equal(input().fire,false);assert.equal(input().move_x,0);assert.equal(d.getElementById('panel').hidden,false);
 d.getElementById('touch-controls').checked=true;d.getElementById('touch-controls').dispatchEvent(new w.Event('input'));d.getElementById('resume').click();await settle();assert.equal(d.getElementById('touch').hidden,false);
 const pad=d.getElementById('move-pad');pad.dispatchEvent(pointer('pointerdown',1,10,10));pad.dispatchEvent(pointer('pointermove',1,45,10));await settle();assert.ok(input().move_x>.5);
 // A second finger must not seize the movement stick.
 pad.dispatchEvent(pointer('pointerdown',2,200,200));pad.dispatchEvent(pointer('pointermove',2,100,100));await settle();assert.ok(input().move_x>.5);
 pad.dispatchEvent(pointer('pointercancel',1));assert.equal(input().move_x,0);
 const trigger=d.getElementById('touch-fire');trigger.dispatchEvent(pointer('pointerdown',3));assert.equal(input().fire,true);trigger.dispatchEvent(pointer('pointercancel',3));assert.equal(input().fire,false);
 socket.onmessage({data:JSON.stringify({type:'state',room:{...room,tick:20,state:{players:room.state.players.map(p=>({...p,health:80}))}}})});
 socket.onmessage({data:JSON.stringify({type:'state',room:{...room,tick:19}})});assert.equal(d.getElementById('health').textContent,'80','a late frame must not restore old health');
 socket.close();assert.equal(d.getElementById('panel').hidden,false);
 assert.equal(d.getElementById('status').classList.contains('error'),false);
 console.log('PASS shipped OpenStrike controller: fast taps, blur/disconnect release, touch ownership/cancellation, persisted touch option, stale-frame rejection');
}finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
