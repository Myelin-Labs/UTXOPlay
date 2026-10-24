// All session-cookie writes share one queue. Ignoring a stale response in React
// alone cannot stop that response from replacing the browser's session cookie.
export function createWalletSession(api) {
  let revision = 0, readSequence = 0, tail = Promise.resolve(), revokeError;
  const current = (ticket) => ticket === revision;
  const enqueue = (operation) => {
    const result = tail.catch(() => {}).then(operation);
    tail = result;
    // Callers still receive the rejection; the queue must also be safe when idle.
    result.catch(() => {});
    return result;
  };
  const revoke = async () => {
    try {
      await api('/api/auth/logout', {});
      revokeError = undefined;
    } catch (error) {
      revokeError = error;
      throw error;
    }
  };
  const settled = async () => {
    await tail.catch(() => {});
    // A new user attempt retries a failed revocation before accepting proof.
    if (revokeError) await enqueue(revoke);
  };
  return {
    current,
    invalidate: () => ++revision,
    settled,
    async readAccount() {
      const ticket = revision, sequence = ++readSequence;
      try {
        await settled();
        const data = await api('/api/me');
        return { stale: !current(ticket) || sequence !== readSequence, data };
      } catch (error) {
        return { stale: !current(ticket) || sequence !== readSequence, error };
      }
    },
    challenge: (ticket, address) => enqueue(async () => {
      if (revokeError) throw revokeError;
      if (!current(ticket)) return;
      return api('/api/auth/challenge', { address });
    }),
    verify: (ticket, proof) => enqueue(async () => {
      if (revokeError) throw revokeError;
      if (!current(ticket)) return;
      return api('/api/auth/verify', proof);
    }),
    guest: (ticket) => enqueue(async () => {
      if (revokeError) throw revokeError;
      if (!current(ticket)) return;
      return api('/api/guest', {});
    }),
    logout() {
      ++revision;
      return enqueue(revoke);
    },
  };
}

// Revoking the website session is independent of an extension's disconnect.
export async function disconnectWallet(disconnect, timeout = 5000) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(disconnect),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Wallet disconnect timed out.')), timeout);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
