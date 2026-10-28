export function walletError(error) {
  let cause = error;
  for (let depth = 0; cause && depth < 8; depth++, cause = cause.cause) {
    if (Number(cause.code) === 4001 || cause.name === 'UserRejectedRequestError') return 'Wallet request declined. You can try again.';
    if (Number(cause.code) === -32002) return 'A wallet request is already open. Check your wallet.';
    if (Number(cause.code) === 4902) return 'This network is not available in your wallet. Add it in your wallet settings and retry.';
    if ([4900, 4901].includes(Number(cause.code))) return 'Your wallet is disconnected from the network. Open it and retry.';
  }
  return 'The wallet request could not be completed. Open your wallet, check its connection, and retry.';
}

// The driver owns connector details; consumers never depend on window.ethereum.
export function createWalletService(driver, settings) {
  let state = Object.freeze({ status: 'disconnected', address: null, chainId: null, error: '', busy: false, revision: 0 });
  let generation = 0, stopped = false, identity = '', identityVersion = 0;
  const listeners = new Set();
  function update(patch) {
    if (stopped) return;
    state = Object.freeze({ ...state, ...patch, revision: state.revision + 1 });
    for (const listener of listeners) listener(state);
  }
  function sync() {
    const connection = driver.connection();
    const address = connection.status === 'connected' ? connection.address : null;
    const chainId = address ? connection.chainId : null;
    const nextIdentity = `${connection.status}:${address}:${chainId}:${connection.connector?.uid}`;
    if (identity !== nextIdentity) { identity = nextIdentity; identityVersion++; }
    update({ address, chainId, status: address ? (chainId === settings.chainId ? 'connected' : 'wrong-network') : connection.status });
  }
  const unwatch = driver.watch(sync);
  sync();
  async function run(operation) {
    if (state.busy) return;
    const current = ++generation;
    update({ busy: true, error: '' });
    try { await operation(); }
    catch (error) { if (current === generation) update({ error: walletError(error) }); }
    finally { if (current === generation) { sync(); update({ busy: false }); } }
  }
  return {
    settings,
    getState: () => state,
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    connectors: () => driver.connectors(),
    connect: id => run(async () => {
      const connector = driver.connectors().find(item => item.id === id);
      if (!connector) throw Error('Wallet no longer available.');
      await driver.connect(connector);
    }),
    reconnect: () => run(() => driver.reconnect()),
    switchNetwork: () => run(() => driver.switchChain(settings.chainId)),
    disconnect: () => run(() => driver.disconnect()),
    clearError: () => update({ error: '' }),
    async session() {
      const before = state;
      const version = identityVersion;
      const connector = driver.connection().connector;
      if (before.status !== 'connected') throw Error('Connect your wallet to the configured network first.');
      const provider = await driver.provider();
      const assertCurrent = async () => {
        const current = driver.connection();
        if (identityVersion !== version || current.connector?.uid !== connector?.uid || current.status !== 'connected' || current.address?.toLowerCase() !== before.address.toLowerCase() || current.chainId !== before.chainId) throw Error('Wallet account or network changed. Prepare the action again.');
        const [accounts, chain] = await Promise.all([
          provider.request({ method: 'eth_accounts' }), provider.request({ method: 'eth_chainId' }),
        ]);
        if (identityVersion !== version || accounts[0]?.toLowerCase() !== before.address.toLowerCase() || BigInt(chain) !== BigInt(before.chainId)) throw Error('Wallet account or network changed. Prepare the action again.');
      };
      await assertCurrent();
      return { address: before.address, chainId: before.chainId, provider, assertCurrent };
    },
    destroy() { stopped = true; generation++; unwatch(); listeners.clear(); driver.destroy?.(); },
  };
}
