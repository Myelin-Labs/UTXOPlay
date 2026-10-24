import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {ccc} from '@ckb-ccc/shell';
import {createApp} from '../server/index.mjs';
import {verifyWallet} from '../server/auth.mjs';

// Real HTTP requests and CKB proofs, with verification deliberately delayed.
for (const mode of ['browser binding', 'existing session']) {
  test(`logout cancels in-flight CKB verification by ${mode} without affecting another browser`, async () => {
    const owner = ccc.ClientPublicMainnet.open();
    const signer = new ccc.SignerCkbPrivateKey(owner.value, '0x'+'21'.repeat(32));
    const address = await signer.getRecommendedAddress();
    const dir = mkdtempSync('/tmp/wallet-revocation-');
    let release, entered;
    const gate = new Promise(r => release=r), started = new Promise(r => entered=r);
    const origin='https://wallet-test.invalid';
    const service=createApp({dataDir:dir,origin,verify:async(...args)=>{entered();await gate;return verifyWallet(...args);}});
    const server=service.app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
    const base='http://127.0.0.1:'+server.address().port;
    async function request(url,body,cookie='') {
      const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
      return {status:response.status,body:await response.json(),cookie:response.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};
    }
    try {
      const guest=await request('/api/guest',{}), other=await request('/api/guest',{});
      const challenge=await request('/api/auth/challenge',{address},guest.cookie);
      const proof=await signer.signMessage(challenge.body.message);
      const pending=request('/api/auth/verify',{id:challenge.body.id,proof},guest.cookie+'; '+challenge.cookie);
      await started;
      const revoked=await request('/api/auth/logout',{},mode==='browser binding'?challenge.cookie:guest.cookie);
      assert.equal(revoked.status,200);
      release();
      const result=await pending;
      assert.equal(result.status,401);assert.match(result.body.error,/cancelled/);
      assert.doesNotMatch(result.cookie,/utxoplay_session=./);
      assert.equal(service.db.prepare('SELECT count(*) AS n FROM accounts WHERE address IS NOT NULL').get().n,0);
      assert.equal((await request('/api/me',undefined,other.cookie)).body.user.id,other.body.user.id);
      // Cancelled proofs remain single-use. A new challenge can still sign in.
      assert.equal((await request('/api/auth/verify',{id:challenge.body.id,proof},challenge.cookie)).status,401);
      const fresh=await request('/api/auth/challenge',{address});
      const login=await request('/api/auth/verify',{id:fresh.body.id,proof:await signer.signMessage(fresh.body.message)},fresh.cookie);
      assert.equal(login.status,200); assert.equal(login.body.user.address,address);
      // Logout also cancels issued but not yet submitted challenges.
      const unused=await request('/api/auth/challenge',{address});
      await request('/api/auth/logout',{},unused.cookie);
      assert.equal((await request('/api/auth/verify',{id:unused.body.id,proof:await signer.signMessage(unused.body.message)},unused.cookie)).status,401);
    } finally {
      release();server.closeAllConnections();await new Promise(r=>server.close(r));service.close();await owner.dispose();rmSync(dir,{recursive:true,force:true});
    }
  });
}
