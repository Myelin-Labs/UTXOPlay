import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWalletSession, disconnectWallet} from '../src/wallet-session.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

test('switching wallets waits for the old verify cookie, revokes it, then accepts the new account', async () => {
  const verifying = deferred(), started = deferred(), events = [];
  let cookie = null;
  const auth = createWalletSession(async (url, body) => {
    if (url.endsWith('/verify')) {
      events.push('verify:' + body.id);
      if (body.id === 'old') { started.resolve(); await verifying.promise; }
      cookie = body.id;
      return {user: {id: cookie}};
    }
    if (url.endsWith('/logout')) { events.push('logout:' + cookie); cookie = null; }
  });
  const old = auth.invalidate(), first = auth.verify(old, {id:'old'});
  await started.promise;
  const logout = auth.logout(), next = auth.invalidate();
  const second = auth.verify(next, {id:'new'});
  assert.equal(auth.current(old), false);
  assert.deepEqual(events, ['verify:old']);
  verifying.resolve();
  await Promise.all([first, logout, second]);
  assert.deepEqual(events, ['verify:old', 'logout:old', 'verify:new']);
  assert.equal(cookie, 'new');
});

test('logout during verification leaves no authenticated cookie after the late response', async () => {
  const gate = deferred(), started = deferred();
  let cookie;
  const auth = createWalletSession(async (url) => {
    if (url.endsWith('/verify')) { started.resolve(); await gate.promise; cookie = 'old'; }
    else cookie = null;
  });
  const ticket = auth.invalidate(), verifying = auth.verify(ticket, {});
  await started.promise;
  const logout = auth.logout();
  gate.resolve();
  await Promise.all([verifying, logout]);
  assert.equal(cookie, null);
  assert.equal(auth.current(ticket), false);
});

test('cancelled queued proof never reaches the server and a fresh attempt works', async () => {
  const calls = [];
  const auth = createWalletSession(async (url) => { calls.push(url); return {user:{id:'new'}}; });
  const old = auth.invalidate(), stale = auth.verify(old, {});
  const fresh = auth.invalidate();
  assert.equal(await stale, undefined);
  assert.deepEqual(calls, []);
  assert.equal((await auth.verify(fresh, {})).user.id, 'new');
});

test('old account reads cannot restore a logged-out account or overwrite a fresh read', async () => {
  const reads = [deferred(), deferred(), deferred()], started = [deferred(), deferred(), deferred()];
  let index = 0;
  const auth = createWalletSession(async (url) => {
    if (url === '/api/me') { const n = index++; started[n].resolve(); return reads[n].promise; }
  });
  const old = auth.readAccount(); await started[0].promise;
  await auth.logout(); reads[0].resolve({user:{id:'old'}});
  assert.equal((await old).stale, true);
  const one = auth.readAccount(); await started[1].promise;
  const two = auth.readAccount(); await started[2].promise;
  reads[2].resolve({user:null}); assert.equal((await two).stale, false);
  reads[1].reject(new Error('late network error')); assert.equal((await one).stale, true);
});

test('failed logout blocks proof until revocation succeeds on retry', async () => {
  let unavailable = true;
  const calls = [];
  const auth = createWalletSession(async (url) => {
    calls.push(url);
    if (url.endsWith('/logout') && unavailable) throw new Error('offline');
    return {user:{id:'new'}};
  });
  await assert.rejects(auth.logout(), /offline/);
  const ticket = auth.invalidate();
  await assert.rejects(auth.verify(ticket, {}), /offline/);
  assert.deepEqual(calls, ['/api/auth/logout']);
  await assert.rejects(auth.settled(), /offline/);
  unavailable = false;
  await auth.settled();
  assert.equal((await auth.verify(ticket, {})).user.id, 'new');
  assert.deepEqual(calls.slice(-2), ['/api/auth/logout', '/api/auth/verify']);
});

test('failed proof does not prevent logout or a later sign-in', async () => {
  let rejectProof = true;
  const auth = createWalletSession(async (url) => {
    if (url.endsWith('/verify') && rejectProof) throw new Error('invalid signature');
    return {user:{id:'new'}};
  });
  await assert.rejects(auth.verify(auth.invalidate(), {}), /invalid signature/);
  await auth.logout(); rejectProof = false;
  assert.equal((await auth.verify(auth.invalidate(), {})).user.id, 'new');
});

test('a cancelled challenge finishes before a replacement can set its browser-binding cookie', async () => {
  const gate = deferred(), started = deferred(), calls = [];
  let cookie;
  const auth = createWalletSession(async (url, body) => {
    calls.push(body.address);
    if (body.address === 'old') { started.resolve(); await gate.promise; }
    cookie = body.address;
    return {id:cookie};
  });
  const old = auth.challenge(auth.invalidate(), 'old'); await started.promise;
  const next = auth.challenge(auth.invalidate(), 'new');
  assert.deepEqual(calls, ['old']); gate.resolve();
  await Promise.all([old, next]); assert.equal(cookie, 'new');
});

test('a guest session started before wallet login cannot overwrite the wallet cookie', async () => {
  const gate = deferred(), started = deferred();
  let cookie;
  const auth = createWalletSession(async (url) => {
    if (url === '/api/guest') { started.resolve(); await gate.promise; cookie = 'guest'; }
    else cookie = 'wallet';
    return {user:{id:cookie}};
  });
  const guestTicket = auth.invalidate(), guest = auth.guest(guestTicket); await started.promise;
  const signed = auth.verify(auth.invalidate(), {}); gate.resolve();
  await Promise.all([guest, signed]);
  assert.equal(auth.current(guestTicket), false); assert.equal(cookie, 'wallet');
});

test('extension disconnect succeeds, rejects or hangs without undoing website logout', async () => {
  assert.equal(await disconnectWallet(() => {}), true);
  assert.equal(await disconnectWallet(() => { throw new Error('extension unavailable'); }), false);
  assert.equal(await disconnectWallet(() => Promise.reject(new Error('rejected'))), false);
  assert.equal(await disconnectWallet(() => new Promise(() => {}), 5), false);
});
