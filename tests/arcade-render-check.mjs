// Actual native Canvas display regression. The old square pixel baseline is
// intentionally replaced: screen projection changed, native game rules did not.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';
import {createGame,step,kinds} from '../games/arcade/web/engine.mjs';import {ArcadeRenderer} from '../games/arcade/web/renderer.mjs';
const require=createRequire(resolve(process.env.ARCADE_TEST_MODULES,'../package.json')),{createCanvas}=require('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1000,1000)};mkdirSync('artifacts/widescreen',{recursive:true});
for(const kind of kinds.filter(k=>k!=='prism-breaker')){
 const canvas=createCanvas(1000,1000);canvas.clientWidth=1920;canvas.clientHeight=1080;const renderer=new ArcadeRenderer(canvas,kind,'#b7a2ff');let g=createGame(kind),previous=structuredClone(g);
 for(let n=0;n<80;n++){previous=structuredClone(g);step(g,kind==='starfall'?16:kind==='neon-coil'?4:0);}
 const savedState=JSON.stringify(g);
 for(const [w,h]of [[1920,1080],[2560,1080],[2560,1440],[3840,2160],[390,844],[844,390]]){
  canvas.clientWidth=w;canvas.clientHeight=h;renderer.draw(g,previous,1,16,2,{running:true,reduced:false,low:false});assert.ok(canvas.width*canvas.height<=8295000);assert.ok(Math.abs(canvas.width/canvas.height-w/h)<.005);
  const c=canvas.getContext('2d');for(const [x,y]of [[0,0],[canvas.width-1,canvas.height-1],[Math.floor(canvas.width/2),Math.floor(canvas.height/2)]])assert.equal(c.getImageData(x,y,1,1).data[3],255,'scene covers viewport');
  if(w===1920)writeFileSync(`artifacts/widescreen/${kind}.png`,canvas.toBuffer('image/png'));
 }
 assert.equal(JSON.stringify(g),savedState,'display never mutates native prediction');const paused={running:false,reduced:true,low:true};renderer.draw(g,previous,1,16,1,paused);const saved=canvas.toBuffer('image/png');for(let n=0;n<60;n++)assert.equal(renderer.draw(g,previous,1,16,1,paused),false);assert.deepEqual(canvas.toBuffer('image/png'),saved);
 renderer.event({type:'damage',x:500,y:500});assert.equal(renderer.draw(g,previous,1,16,1,paused),true);for(let n=0;n<70;n++)renderer.draw(g,previous,1,16,1,paused);assert.equal(renderer.draw(g,previous,1,16,1,paused),false);
 console.log(`${kind}: six display sizes, pixel cap, full scene, immutable rules, idle and effect invalidation passed`);
}
let callback,reads=0;globalThis.ResizeObserver=class{constructor(cb){callback=cb;}observe(){}};
const canvas=createCanvas(600,600);Object.defineProperty(canvas,'clientWidth',{get(){reads++;return 600;}});Object.defineProperty(canvas,'clientHeight',{get(){return 400;}});
const renderer=new ArcadeRenderer(canvas,'starfall','#b7a2ff'),g=createGame('starfall');for(let n=0;n<30;n++)renderer.draw(g,g,1,16,1,{running:true,reduced:false,low:false});assert.equal(reads,1);callback([{contentRect:{width:450,height:253}}]);renderer.draw(g,g,1,16,1,{running:true,reduced:false,low:false});assert.equal(canvas.width,450);assert.equal(canvas.height,253);assert.equal(reads,1);console.log('ResizeObserver updates both dimensions without per-frame layout reads.');
