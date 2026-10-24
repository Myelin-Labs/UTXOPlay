// Compare cached rendering with the pre-optimization renderer across live changes.
// Optional native Canvas; see docs/arcade-performance.md.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createGame,step,kinds} from '../games/arcade/web/engine.mjs';
import {ArcadeRenderer} from '../games/arcade/web/renderer.mjs';
const require=createRequire(process.env.ARCADE_TEST_MODULES?resolve(process.env.ARCADE_TEST_MODULES,'../package.json'):import.meta.url);
const {createCanvas}=require('@napi-rs/canvas');
const {ArcadeRenderer:Reference}=await import(pathToFileURL(resolve(process.env.BASELINE_RENDERER||'artifacts/arcade-performance/baseline/renderer.mjs')));
globalThis.document={createElement:()=>createCanvas(1000,1000)};
for(const kind of kinds.filter(kind=>kind!=='prism-breaker')){
 const a=createCanvas(600,600),b=createCanvas(600,600);a.clientWidth=b.clientWidth=600;
 const reference=new Reference(a,kind,'#b7a2ff'),renderer=new ArcadeRenderer(b,kind,'#b7a2ff');
 let game=createGame(kind),previous=structuredClone(game);let worstMean=0;
 for(let frame=0;frame<120;frame++){
  previous=structuredClone(game);step(game,kind==='starfall'?16:kind==='neon-coil'?4:0);
  if(frame===35&&kind==='prism-breaker'){game.cells[0]=0;game.cells[2]=0;} // explicit invalidation
  if(frame===65){game=createGame(kind);reference.reset();renderer.reset();previous=structuredClone(game);}
  if(frame===85)a.clientWidth=b.clientWidth=420;
  const options={running:true,reduced:frame>=90,low:frame>=75};const ratio=frame<45?1:2;
  reference.tick(game);renderer.tick(game);
  reference.draw(game,previous,.5,1000/60,ratio,options);renderer.draw(game,previous,.5,1000/60,ratio,options);
  if(frame%10===0||[35,45,65,75,85,90].includes(frame)){
   const old=a.getContext('2d').getImageData(0,0,a.width,a.height).data,next=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
   assert.equal(old.length,next.length);let error=0;for(let i=0;i<old.length;i++)error+=Math.abs(old[i]-next[i]);
   const mean=error/old.length;worstMean=Math.max(worstMean,mean);assert.ok(mean<.03,`${kind}, frame ${frame}: pixel difference ${mean}`);
  }
 }
 const paused={running:false,reduced:true,low:true};renderer.draw(game,previous,1,16,2,paused);
 const saved=b.toBuffer('image/png');for(let i=0;i<60;i++)assert.equal(renderer.draw(game,previous,1,16,2,paused),false);
 assert.deepEqual(b.toBuffer('image/png'),saved);
 assert.equal(renderer.draw(game,previous,1,16,1,paused),true,'resizing must invalidate a paused frame');
 renderer.event({type:'damage',x:500,y:500});assert.equal(renderer.draw(game,previous,1,16,1,paused),true,'effects must invalidate a paused frame');
 for(let i=0;i<70;i++)renderer.draw(game,previous,1,16,1,paused);
 assert.equal(renderer.draw(game,previous,1,16,1,paused),false,'settled effects must stop drawing');
 console.log(`${kind}: dynamic/reset/resize/quality pixel comparison passed (worst mean ${worstMean.toFixed(5)} / 255); 60 idle frames skipped`);
}
// Real ResizeObserver path: repeated draws must not query layout.
let observerCallback,reads=0;globalThis.ResizeObserver=class{constructor(cb){observerCallback=cb;}observe(){}};
const canvas=createCanvas(600,600);Object.defineProperty(canvas,'clientWidth',{get(){reads++;return 600;}});
const renderer=new ArcadeRenderer(canvas,'starfall','#b7a2ff'),g=createGame('starfall');const previous=structuredClone(g);
for(let i=0;i<30;i++)renderer.draw(g,previous,1,16,1,{running:true,reduced:false,low:false});
assert.equal(reads,1);observerCallback([{contentRect:{width:450}}]);renderer.draw(g,previous,1,16,1,{running:true,reduced:false,low:false});assert.equal(canvas.width,450);assert.equal(reads,1);
console.log('Resize observer updates backing dimensions without per-frame layout reads.');
