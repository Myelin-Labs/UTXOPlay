// Real runtime crash recovery in disposable local directories, with no production restart.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';

for (const [game, port] of [['chess',18981],['sling',18982]]) {
  const dir = await mkdtemp(join(tmpdir(), 'utxoplay-restart-'));
  const token = randomBytes(32).toString('hex');
  const headers = {'X-Runtime-Token':token,'X-UTXOPlay-Account':'a'.repeat(64),'Content-Type':'application/json'};
  let child;
  async function start() {
    child = spawn(`./deploy/bin/myelin-${game}`, [], {env:{...process.env,PORT:String(port),BIND:'127.0.0.1',DATA_DIR:dir,RUNTIME_TOKEN:token},stdio:['ignore','pipe','pipe']});
    await Promise.race([once(child.stdout,'data'), once(child,'exit').then(()=>{throw new Error('Runtime exited before readiness');})]);
  }
  async function stop() { const exited=once(child,'exit'); child.kill('SIGKILL'); await exited; child=null; }
  async function request(path, body) {
    const r=await fetch(`http://127.0.0.1:${port}/api/${path}`, {method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(r.status,200);return r.json();
  }
  try {
    await start();
    const before=await request('state');
    const action=game==='chess'?{type:'move',uci:'e2e4'}:{type:'launch',dx:-90,dy:45};
    const moved=await request('action',{session_id:before.session.id,expected_block:before.session.block_hash,action});
    await stop();await start();
    const restored=await request('state');
    assert.equal(restored.session.id,moved.session.id);
    assert.equal(restored.session.block_hash,moved.session.block_hash);
    assert.equal(restored.session.actions,1);
    assert.equal((await request('replay',{})).verified,true);
    console.log(`${game}: crash restart restored the exact saved state and verified replay PASS`);
  } finally {if(child)await stop();await rm(dir,{recursive:true,force:true});}
}
