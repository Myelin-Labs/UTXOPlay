import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChessEngine} from '../games/chess/web/engine-client.mjs';
import {assetCache} from '../server/static.mjs';
test('Stockfish UCI handshake, bounded search, warm worker reuse and cancellation isolate stale replies',()=>{
 const original=globalThis.Worker,workers=[];
 class Worker {constructor(){this.commands=[];workers.push(this);}postMessage(s){this.commands.push(s);}terminate(){this.terminated=true;}reply(s){this.onmessage({data:s});}}
 globalThis.Worker=Worker;const engine=new ChessEngine(),moves=[],errors=[];
 try{
  const run=()=>engine.run({moves:['e2e4'],level:'expert',onMove:m=>moves.push(m),onError:e=>errors.push(e)});
  run();const first=workers[0];assert.deepEqual(first.commands,['uci']);first.reply('uciok');assert.deepEqual(first.commands.slice(1),['setoption name Hash value 16','isready']);first.reply('readyok');assert.ok(first.commands.includes('go movetime 1100'));assert.ok(first.commands.includes('position startpos moves e2e4'));
  first.reply('bestmove e7e5 ponder g1f3');assert.deepEqual(moves,['e7e5']);run();assert.equal(workers.length,1);
  engine.cancel();assert.equal(first.terminated,true);run();const second=workers[1];first.reply('bestmove a7a6');assert.equal(moves.length,1);
  second.reply('uciok');second.reply('readyok');second.reply('bestmove c7c5');assert.deepEqual(moves,['e7e5','c7c5']);assert.deepEqual(errors,[]);
 }finally{engine.dispose();globalThis.Worker=original;}
 assert.match(assetCache('stockfish-17.1-lite-single-03e3232.wasm'),/immutable/);
});
