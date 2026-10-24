import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {signatureTape} from './signature-tapes.mjs';
import {createGame,step} from '../games/arcade/web/engine.mjs';
const base=process.env.STORE_URL||'http://127.0.0.1:19130',dir=mkdtempSync('/tmp/signature-exports-');
async function req(path,body,cookie=''){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return {value,cookie:r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')};}
try{for(const kind of ['prism-breaker','neon-coil','starfall','drift-run']){
 const {cookie}=await req('/api/guest',{}),prefix=`/games/${kind}/api/`,tape=signatureTape(kind);let {value:state}=await req(prefix+'state',undefined,cookie);const prediction=createGame(kind);
 for(let i=0;i<tape.inputs.length;i+=60){const inputs=tape.inputs.slice(i,i+60);state=(await req(prefix+'action',{session_id:state.session.id,expected_block:state.session.block_hash,action:{type:'ticks',inputs}},cookie)).value;for(const bits of inputs)step(prediction,bits);assert.deepEqual(state.game,prediction);}
 assert.deepEqual(state.game,tape.game);assert.ok((state.game.specials??state.game.refractions)>0);
 assert.deepEqual((await req(prefix+'state',undefined,cookie)).value.game,tape.game);
 const replay=(await req(prefix+'replay',{},cookie)).value;assert.equal(replay.verified,true);assert.equal(replay.state_root,state.session.state_root);
 const exported=(await req(prefix+'export',undefined,cookie)).value,file=dir+'/'+kind+'.json';writeFileSync(file,JSON.stringify(exported));
 const bin=kind==='prism-breaker'?(process.env.PRISM_BIN||'artifacts/portable-build/target/debug/myelin-prism-breaker'):(process.env.ARCADE_BIN||'artifacts/portable-build/target/debug/myelin-arcade');
 const verify=spawnSync(bin,['verify',file],{encoding:'utf8'});assert.equal(verify.status,0,verify.stderr);assert.equal(JSON.parse(verify.stdout).state_root,state.session.state_root);
 console.log(`${kind}: signature triggered from genesis, ${tape.inputs.length} ticks, every batch exact, persisted, signed replay and offline verification passed`);
}}
finally{rmSync(dir,{recursive:true,force:true});}
