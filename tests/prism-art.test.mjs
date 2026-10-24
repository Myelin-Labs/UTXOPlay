import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPrismArt,prismNames} from '../games/arcade/web/prism-art.mjs';
test('Prism waits for every decoded sprite and cover, reports actual asset counts, and rejects broken art',async()=>{
 const oldImage=globalThis.Image,oldLoader=globalThis.UTXOPlayLoader;
 try{
  const pending=[],counts=[],errors=[];
  globalThis.Image=class{decode(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
  globalThis.UTXOPlayLoader={assets:(...count)=>counts.push(count),fail:stage=>errors.push(stage)};
  const cover=new Image(),result=loadPrismArt(cover);let done=false;result.then(()=>done=true);
  assert.equal(pending.length,15);assert.deepEqual(counts,[[0,15]]);
  pending.slice(1).reverse().forEach(p=>p.resolve());await Promise.resolve();await Promise.resolve();
  assert.equal(done,false);assert.deepEqual(counts.at(-1),[14,15]);pending[0].resolve();
  const art=await result;assert.deepEqual(Object.keys(art),[...prismNames,'cover']);assert.deepEqual(counts.at(-1),[15,15]);assert.deepEqual(errors,[]);
  const start=pending.length,rejected=loadPrismArt(new Image());pending[start].reject(new Error('missing crystal'));
  await assert.rejects(rejected,/missing crystal/);assert.deepEqual(errors,['assets']);
  pending.slice(start+1).forEach(p=>p.resolve());await Promise.resolve();
 }finally{globalThis.Image=oldImage;globalThis.UTXOPlayLoader=oldLoader;}
});
