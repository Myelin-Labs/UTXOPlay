// Native Canvas microbenchmark, not browser/GPU FPS. Optional @napi-rs/canvas.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createGame,step,kinds} from '../games/arcade/web/engine.mjs';
const require=createRequire(process.env.ARCADE_TEST_MODULES?resolve(process.env.ARCADE_TEST_MODULES,'../package.json'):import.meta.url);
const {createCanvas}=require('@napi-rs/canvas');
const {ArcadeRenderer}=await import(pathToFileURL(resolve(process.env.RENDERER||'games/arcade/web/renderer.mjs')));
globalThis.document={createElement:()=>createCanvas(1000,1000)};
const output=process.env.BENCH_OUTPUT||'artifacts/arcade-performance/current';mkdirSync(output,{recursive:true});
const rows=[];
for(const kind of kinds)for(const ratio of [1,2]){
 const canvas=createCanvas(600,600);canvas.clientWidth=600;
 const renderer=new ArcadeRenderer(canvas,kind,'#b7a2ff'),game=createGame(kind);
 for(let i=0;i<30;i++)step(game,kind==='starfall'?16:kind==='neon-coil'?4:0);
 // Include a long, valid-looking body to exercise the higher-cost snake renderer.
 if(kind==='neon-coil')game.trail=Array.from({length:80},(_,i)=>[i%20,3+Math.floor(i/20)]);
 const previous=structuredClone(game),samples=[];
 for(let i=0;i<100;i++){
  const start=performance.now();renderer.draw(game,previous,.5,1000/60,ratio,{running:true,reduced:false,low:false});
  canvas.getContext('2d').getImageData(0,0,1,1);
  if(i>=20)samples.push(performance.now()-start);
 }
 writeFileSync(`${output}/${kind}-${ratio}.png`,canvas.toBuffer('image/png'));
 samples.sort((a,b)=>a-b);const row={kind,ratio,medianMs:+samples[40].toFixed(3),p95Ms:+samples[76].toFixed(3)};rows.push(row);console.log(JSON.stringify(row));
}
writeFileSync(output+'/results.json',JSON.stringify(rows,null,2)+'\n');
