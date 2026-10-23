import { createHash } from 'node:crypto';
import { ccc } from '@ckb-ccc/shell';
const clientOwner = ccc.ClientPublicMainnet.open();
const client = clientOwner.value;
export const digest = (value) => createHash('sha256').update(value).digest('hex');
const requireString = (value, max = 8192) => {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new Error('Invalid wallet proof');
  return value;
};
export async function verifyWallet(message, proof, address) {
  if (!proof || typeof proof !== 'object') throw new Error('Missing wallet proof');
  const signType = requireString(proof.signType, 30);
  const rawIdentity = requireString(proof.identity, 4096);
  const rawSignature = requireString(proof.signature, 16384);
  if (!['CkbSecp256k1','BtcEcdsa','JoyId'].includes(signType)) throw new Error('Choose a supported CKB or Bitcoin wallet account');
  requireString(address, 300);
  if (!address.startsWith('ckb1')) throw new Error('Please connect to CKB mainnet');
  const claimed = await ccc.Address.fromString(address, client);
  let identity = rawIdentity, signature = rawSignature, joy;
  let expected;
  if (signType === 'CkbSecp256k1') {
    if (!/^0x0[23][0-9a-fA-F]{64}$/.test(identity)) throw new Error('Invalid CKB public key');
    expected = await new ccc.SignerCkbPublicKey(client, identity).getRecommendedAddressObj();
  } else if (signType === 'BtcEcdsa') {
    if (!/^0[23][0-9a-fA-F]{64}$/.test(identity)) throw new Error('Invalid Bitcoin public key');
    expected = await ccc.Address.fromKnownScript(client, ccc.KnownScript.OmniLock, ccc.hexFrom([0x04, ...ccc.btcEcdsaPublicKeyHash(identity), 0x00]));
  } else {
    joy = JSON.parse(identity);
    const signed = JSON.parse(signature);
    if (!['main_key', 'sub_key'].includes(joy.keyType)) throw new Error('Please use your JoyID Passkey, not a temporary session key');
    requireString(joy.publicKey, 4096);
    if (!/^[0-9a-fA-F]+$/.test(joy.publicKey)) throw new Error('Invalid JoyID public key');
    requireString(signed.signature); requireString(signed.message);
    if (![-7,-257].includes(signed.alg)) throw new Error('Unsupported JoyID signing algorithm');
    joy.alg = signed.alg;
    identity = JSON.stringify({ publicKey: joy.publicKey, keyType: joy.keyType });
    signature = JSON.stringify({ signature: signed.signature, alg: signed.alg, message: signed.message });
    const lock = await ccc.Script.fromKnownScript(client, ccc.KnownScript.JoyId, claimed.script.args);
    if (!lock.eq(claimed.script) || ccc.bytesFrom(claimed.script.args).length !== 22) throw new Error('Invalid JoyID CKB address');
  }
  if (expected && !expected.script.eq(claimed.script)) throw new Error('This signature does not control the selected CKB address');
  if (!(await ccc.Signer.verifyMessage(message, {signType, identity, signature}))) throw new Error('Wallet signature verification failed');
  if (joy) {
    const response = await fetch(`https://api.joy.id/api/v1/credentials/${encodeURIComponent(address)}`, {signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('JoyID account verification is temporarily unavailable');
    const data = await response.json();
    if (!Array.isArray(data.credentials) || !data.credentials.some(c => c.ckb_address === address && (joy.alg === -257 ? c.public_key : c.public_key?.slice(2)) === joy.publicKey)) throw new Error('JoyID credential is not registered to this account');
  }
  return {id:digest('utxoplay:ckb-mainnet:'+claimed.script.hash()), address:claimed.toString(), scheme:signType};
}
