import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {ccc} from '@ckb-ccc/shell';
const base=process.env.STORE_URL||'http://127.0.0.1:8790';
const owner=ccc.ClientPublicMainnet.open();
try {
 const signer=new ccc.SignerCkbPrivateKey(owner.value,'0x'+randomBytes(32).toString('hex'));
 const address=await signer.getRecommendedAddress();
 async function req(url,body,cookie=''){const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:await r.json(),cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
 async function login(){const c=await req('/api/auth/challenge',{address});assert.equal(c.status,200);const proof=await signer.signMessage(c.data.message);const r=await req('/api/auth/verify',{id:c.data.id,proof},c.cookie);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal((await req('/api/auth/verify',{id:c.data.id,proof},c.cookie)).status,401);return r;}
 const first=await login();assert.equal(first.data.user.address,address);assert.equal(first.data.user.guest,false);
 const state=(await req('/games/chess/api/state',undefined,first.cookie)).data;
 const moved=await req('/games/chess/api/action',{session_id:state.session.id,expected_block:state.session.block_hash,action:{type:'move',uci:'d2d4'}},first.cookie);assert.equal(moved.status,200);
 await req('/api/auth/logout',{},first.cookie);assert.equal((await req('/games/chess/api/state',undefined,first.cookie)).status,401);
 const second=await login();assert.equal(second.data.user.id,first.data.user.id);
 const resumed=await req('/games/chess/api/state',undefined,second.cookie);assert.equal(resumed.data.session.block_hash,moved.data.session.block_hash);
 await req('/api/auth/logout',{},second.cookie);
 console.log('PASS: live CKB cryptographic login, nonce replay rejection, logout revocation, fresh login and wallet save recovery. Disposable test key; no funds or transactions.');
} finally{await owner.dispose();}
