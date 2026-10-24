// Isolated authority test: full campaign, account isolation, rejected writes, recovery, export verification.
import{spawn,spawnSync}from'node:child_process';import{mkdtempSync,readFileSync,writeFileSync}from'node:fs';import{randomBytes}from'node:crypto';import{resolve,join}from'node:path';import assert from'node:assert/strict';import{createPrism as createGame,prismStep,choosePerk}from'../games/arcade/web/prism-engine.mjs';
const apply=(g,a)=>{if(a.type==='perk')choosePerk(g,a.choice);else for(const i of a.inputs)prismStep(g,i);};
const bin=resolve(process.env.PRISM_BIN||'deploy/bin/myelin-prism-breaker'),dir=mkdtempSync('/tmp/prism-campaign-signed-'),token=randomBytes(32).toString('hex'),account=randomBytes(32).toString('hex'),other=randomBytes(32).toString('hex'),port=19097;
let child;function launch(){child=spawn(bin,[],{env:{...process.env,PORT:String(port),BIND:'127.0.0.1',RUNTIME_TOKEN:token,DATA_DIR:dir},stdio:['ignore','ignore','inherit']});return new Promise((resolve,reject)=>{child.once('error',reject);child.once('spawn',resolve);});}
async function req(endpoint,body,who=account,status=200){const r=await fetch(`http://127.0.0.1:${port}/prism-breaker/api/`+endpoint,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Runtime-Token':token,'X-UTXOPlay-Account':who},body:body===undefined?undefined:JSON.stringify(body)});const v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
async function ready(){for(let n=0;n<100;n++){try{return await req('state');}catch(error){if(n===99)throw error;await new Promise(r=>setTimeout(r,50));}}}
async function stop(){const current=child;if(current.exitCode!==null)return;const exit=new Promise(r=>current.once('exit',r));current.kill();await exit;}
try{await launch();let state=await ready(),start=state;const untouched=await req('state',undefined,other),g=createGame();assert.deepEqual(state.game,g);
for(const action of JSON.parse(readFileSync('artifacts/prism/campaign-actions.json'))){const before=state;state=await req('action',{session_id:state.session.id,expected_block:state.session.block_hash,action});apply(g,action);assert.deepEqual(state.game,g);if(action.type==='perk'&&g.level%6===0)console.log('Signed sector',g.level);
 if(action.type==='perk'){const rejected=await req('action',{session_id:before.session.id,expected_block:before.session.block_hash,action},account,400);assert.ok(rejected.error);}}
assert.equal(g.level,24);assert.equal(g.over,true);assert.ok(!g.cells.some(Boolean));assert.deepEqual((await req('state',undefined,other)).game,untouched.game);
await req('action',{session_id:start.session.id,expected_block:start.session.block_hash,action:{type:'ticks',inputs:[1]}},account,400);
await req('action',{session_id:state.session.id,expected_block:state.session.block_hash,action:{type:'buy',item:'winch',price:0}},account,400);
assert.equal((await req('state')).session.block_hash,state.session.block_hash);const replay=await req('replay',{});assert.equal(replay.verified,true);
const file=join(dir,'expedition.json');writeFileSync(file,JSON.stringify(await req('export')));const verified=spawnSync(bin,['verify',file],{encoding:'utf8'});assert.equal(verified.status,0,verified.stderr);assert.equal(JSON.parse(verified.stdout).state_root,state.session.state_root);
await stop();await launch();const recovered=await ready();assert.deepEqual(recovered,state);console.log(JSON.stringify({sectors:24,frames:replay.frames,recovered:true,offlineVerified:true,evidence:file}));
}finally{await stop();}
