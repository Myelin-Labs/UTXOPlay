import {loadTestArt} from './premium-art-helper.mjs';
// Actual Canvas render, bounded effects, idle invalidation and CPU timing.
import {createRequire} from 'node:module';import {resolve} from 'node:path';import {mkdirSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {PrismRenderer} from '../games/arcade/web/prism-renderer.mjs';import {createGame,step} from '../games/arcade/web/engine.mjs';
const require=createRequire(resolve(process.env.ARCADE_TEST_MODULES,'../package.json')),{createCanvas,loadImage}=require('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1000,1000)};
const images=await loadTestArt('prism-breaker');
const output='artifacts/prism';mkdirSync(output,{recursive:true});
const canvas=createCanvas(1000,1000);canvas.clientWidth=1920;canvas.clientHeight=1080;const renderer=new PrismRenderer(canvas);renderer.art=images;const g=createGame('prism-breaker');let previous=structuredClone(g);
for(let n=0;n<160;n++){previous=structuredClone(g);const bit=g.bodies[0].x<g.x-12?1:g.bodies[0].x>g.x+12?2:0;step(g,bit);renderer.tick(g);renderer.draw(g,previous,.5,1000/60,1,{running:true,reduced:false,low:false});}
writeFileSync(output+'/gameplay.png',canvas.toBuffer('image/png'));
const samples=[];for(let n=0;n<100;n++){renderer.dirty=true;const start=performance.now();renderer.draw(g,previous,.5,16,1,{running:true,reduced:false,low:false});canvas.getContext('2d').getImageData(0,0,1,1);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
for(let n=0;n<100;n++)renderer.event({type:'brick',x:300,y:135,value:40});assert.ok(renderer.shards.length<=96);assert.ok(renderer.labels.length<=12);assert.ok(renderer.impacts.length<=16);
for(let n=0;n<120;n++)renderer.draw(g,previous,1,16,1,{running:false,reduced:true,low:true});assert.equal(renderer.draw(g,previous,1,16,1,{running:false,reduced:true,low:true}),false);
assert.equal(renderer.draw(g,previous,1,16,1,{running:false,reduced:false,low:false}),true,'quality and motion changes invalidate idle frames');
renderer.setLens(false);assert.equal(renderer.draw(g,previous,1,16,1,{running:false,reduced:true,low:true}),true);assert.equal(renderer.draw(g,previous,1,16,1,{running:false,reduced:true,low:true}),false);
const immutable=JSON.stringify(g);
for(const [w,h]of [[1920,1080],[2560,1080],[2560,1440],[3840,2160],[390,844],[844,390]]){canvas.clientWidth=w;canvas.clientHeight=h;renderer.dirty=true;renderer.draw(g,g,1,16,2,{running:false,reduced:true,low:false});assert.ok(canvas.width*canvas.height<=8295000);writeFileSync(`${output}/display-${w}.png`,canvas.toBuffer('image/png'));}
assert.equal(JSON.stringify(g),immutable);
canvas.clientWidth=390;canvas.clientHeight=844;assert.equal(renderer.draw(g,previous,1,16,2,{running:false,reduced:true,low:true}),true);assert.equal(canvas.width,780);
g.level=3;renderer.dirty=true;renderer.draw(g,g,1,16,2,{running:false,reduced:false,low:false});writeFileSync(output+'/aurora.png',canvas.toBuffer('image/png'));
const metrics={medianMs:+samples[50].toFixed(3),p95Ms:+samples[95].toFixed(3),note:'Native Canvas CPU microbenchmark, not browser FPS'};writeFileSync(output+'/metrics.json',JSON.stringify(metrics,null,2));console.log('Prism render/effect/idle/resize checks passed',metrics);
