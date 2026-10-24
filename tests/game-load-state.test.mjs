import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialLoad,acceptLoadMessage} from '../src/game-load-state.mjs';
const report={type:'utxoplay:load',game:'neon-miner',attempt:'neon-miner:2',progress:10,steps:[true,false,false,false],phase:'Loading artwork',detail:'0 / 16 artwork assets ready',error:'',ready:false};
const accept=(state,data)=>acceptLoadMessage(state,data,'neon-miner','neon-miner:2');
test('startup reports reject stale launches, wrong games, regressions and incomplete completion',()=>{
 const initial=initialLoad(),first=accept(initial,report);assert.equal(first.progress,10);
 for(const patch of [{type:'utxoplay:game-ready'},{game:'chess'},{attempt:'neon-miner:1'},{progress:9},{progress:10.5},{progress:101},{steps:[true]},{steps:[false,false,false,false]},{ready:true},{progress:100},{progress:100,ready:true},{progress:100,steps:[true,true,true,true],ready:true,error:'failed'}])assert.equal(accept(first,{...report,...patch}),null,JSON.stringify(patch));
 const ready=accept(first,{...report,progress:100,steps:[true,true,true,true],ready:true});assert.equal(ready.ready,true);assert.equal(accept(ready,report),null);
});
test('startup failures preserve earned progress and permit a fresh attempt',()=>{
 const state=accept(initialLoad(),{...report,progress:55,steps:[true,true,false,false]});const failed=accept(state,{...report,progress:55,steps:state.steps,error:'Session unavailable'});assert.equal(failed.error,'Session unavailable');assert.equal(failed.ready,false);assert.equal(accept(initialLoad(),report).progress,10);
});
test('every bundled entrypoint installs the same loader before its game module',()=>{
 const games=JSON.parse(readFileSync(new URL('../server/catalog.json',import.meta.url)));
 assert.equal(games.length,9);
 for(const game of games){const html=readFileSync(new URL(`../games/${game.id}/web/index.html`,import.meta.url),'utf8');const loader=html.indexOf('/game-loader.js?v=0.14.0');assert.ok(loader>=0,game.id);assert.ok(loader<html.indexOf('</head>'),game.id);assert.ok(loader<html.indexOf('<script type="module"'),game.id);}
});
