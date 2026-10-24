import test from 'node:test';import assert from 'node:assert/strict';
import {loadArtwork,packs,artUrl} from '../games/arcade/web/premium-art.mjs';
import {existsSync} from 'node:fs';
for(const kind of Object.keys(packs))test(`${kind} waits for decoded environment, atlas and cover; failed art blocks play and can retry`,async()=>{
 const oldImage=globalThis.Image,oldLoader=globalThis.UTXOPlayLoader;
 try{
  const pending=[],counts=[],errors=[];globalThis.Image=class{decode(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
  globalThis.UTXOPlayLoader={assets:(...count)=>counts.push(count),fail:stage=>errors.push(stage)};
  const result=loadArtwork(kind,new Image());let done=false;result.then(()=>done=true);
  assert.equal(pending.length,3);assert.deepEqual(counts,[[0,3]]);
  pending.slice(1).forEach(p=>p.resolve());await Promise.resolve();await Promise.resolve();assert.equal(done,false);assert.deepEqual(counts.at(-1),[2,3]);pending[0].resolve();
  assert.deepEqual(Object.keys(await result),['bg','atlas','cover']);assert.deepEqual(counts.at(-1),[3,3]);assert.deepEqual(errors,[]);
  const start=pending.length,rejected=loadArtwork(kind,new Image());pending[start].reject(new Error('missing environment'));await assert.rejects(rejected,/missing environment/);assert.deepEqual(errors,['assets']);pending.slice(start+1).forEach(p=>p.resolve());await Promise.resolve();
  const retryStart=pending.length,retry=loadArtwork(kind,new Image());pending.slice(retryStart).forEach(p=>p.resolve());await retry;assert.deepEqual(counts.at(-1),[3,3]);
  for(const name of ['bg','atlas'])assert.ok(existsSync('games/arcade/web'+artUrl(kind,name).split('?')[0].replace('/arcade','')));
  for(const rect of Object.values(packs[kind].rects)){const[x,y,w,h]=rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1536&&y+h<=1024);}
 }finally{globalThis.Image=oldImage;globalThis.UTXOPlayLoader=oldLoader;}
});
