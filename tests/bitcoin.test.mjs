import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {ccc} from '@ckb-ccc/shell';
import {secp256k1} from '@noble/curves/secp256k1.js';
import {verifyWallet} from '../server/auth.mjs';
const owner=ccc.ClientPublicMainnet.open();after(()=>owner.dispose());
test('Bitcoin wallet signature binds the derived OmniLock account',async()=>{
 const key=new Uint8Array(32).fill(21),pubkey=secp256k1.getPublicKey(key,true);
 const identity=Buffer.from(pubkey).toString('hex');
 const message='Sign in to UTXOPlay. Nonce: '+ 'x'.repeat(300);
 const compact=secp256k1.sign(ccc.messageHashBtcEcdsa(message),key,{prehash:false});
 const signature=Buffer.concat([Buffer.from([31]),Buffer.from(compact)]).toString('base64');
 const address=(await ccc.Address.fromKnownScript(owner.value,ccc.KnownScript.OmniLock,ccc.hexFrom([4,...ccc.btcEcdsaPublicKeyHash(identity),0]))).toString();
 const proof={signType:'BtcEcdsa',identity,signature};
 assert.equal((await verifyWallet(message,proof,address)).address,address);
 await assert.rejects(()=>verifyWallet(message+'altered',proof,address));
 const wrong=(await ccc.Address.fromKnownScript(owner.value,ccc.KnownScript.OmniLock,ccc.hexFrom([4,...new Uint8Array(20).fill(3),0]))).toString();
 await assert.rejects(()=>verifyWallet(message,proof,wrong),/does not control/);
});
