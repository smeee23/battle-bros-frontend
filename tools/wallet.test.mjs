import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { createInjectedDriver } from '../wallet/driver.mjs';
import { createWalletService, walletError } from '../wallet/service.mjs';
import { walletSettings, assertTrustedPublication } from '../wallet/config.mjs';

const alice = '0x1111111111111111111111111111111111111111';
const bob = '0x2222222222222222222222222222222222222222';
const settings = { chainId: 31337 };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
class Provider extends EventEmitter {
  accounts = [alice]; chain = '0x7a69'; methods = []; reject = null;
  async request({ method, params }) {
    this.methods.push(method);
    if (this.reject && ['eth_requestAccounts', 'wallet_requestPermissions', 'wallet_switchEthereumChain'].includes(method)) throw this.reject;
    if (method === 'wallet_requestPermissions') throw { code: 4200 };
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return this.accounts;
    if (method === 'eth_chainId') return this.chain;
    if (method === 'wallet_switchEthereumChain') {
      this.chain = params[0].chainId; this.emit('chainChanged', this.chain); return null;
    }
    if (method === 'wallet_revokePermissions') return null;
    throw Error('Unexpected request: ' + method);
  }
}
function browser(provider) {
  globalThis.window = new EventTarget();
  window.ethereum = provider;
}
function service(store = storage()) {
  const driver = createInjectedDriver(settings, store);
  return { driver, wallet: createWalletService(driver, settings) };
}

test('real injected connector: connect, account/chain changes, switch, stale-session rejection, disconnect', async () => {
  const provider = new Provider(); browser(provider);
  const { wallet } = service();
  try {
    await wallet.reconnect();
    assert.equal(wallet.getState().status, 'disconnected');
    assert(!provider.methods.includes('eth_requestAccounts'), 'Fresh visits must not prompt');
    await wallet.connect('injected');
    assert.equal(wallet.getState().status, 'connected');
    assert.equal(wallet.getState().address, alice);
    const session = await wallet.session();
    provider.accounts = [bob]; provider.emit('accountsChanged', provider.accounts); await flush();
    assert.equal(wallet.getState().address, bob);
    await assert.rejects(session.assertCurrent, /changed/);
    provider.chain = '0x1'; provider.emit('chainChanged', provider.chain); await flush();
    assert.equal(wallet.getState().status, 'wrong-network');
    await assert.rejects(wallet.session, /configured network/);
    await wallet.switchNetwork();
    assert.equal(wallet.getState().status, 'connected');
    await wallet.disconnect();
    assert.equal(wallet.getState().address, null);
    await wallet.reconnect();
    assert.equal(wallet.getState().status, 'disconnected', 'Explicit disconnect survives reconnect');
    assert(!provider.methods.some(method => /sendTransaction|sign|eth_call|eth_blockNumber/.test(method)), 'Connecting must never transact, sign, or read game state');
  } finally { wallet.destroy(); delete globalThis.window; }
});

test('reconnect across page initialization uses saved connector without prompting', async () => {
  const provider = new Provider(), store = storage(); browser(provider);
  const first = service(store);
  await first.wallet.connect('injected'); first.wallet.destroy();
  const prompts = provider.methods.filter(method => method === 'eth_requestAccounts').length;
  const second = service(store);
  try {
    await second.wallet.reconnect();
    assert.equal(second.wallet.getState().status, 'connected');
    assert.equal(provider.methods.filter(method => method === 'eth_requestAccounts').length, prompts);
    provider.accounts = []; provider.emit('accountsChanged', []); await flush();
    assert.equal(second.wallet.getState().address, null);
  } finally { second.wallet.destroy(); delete globalThis.window; }
});

test('rejected connection and network switch recover without losing connection', async () => {
  const provider = new Provider(); browser(provider);
  const { wallet } = service();
  try {
    provider.reject = { code: 4001 };
    await wallet.connect('injected');
    assert.match(wallet.getState().error, /declined/);
    assert.equal(wallet.getState().busy, false);
    provider.reject = null; await wallet.connect('injected');
    provider.chain = '0x1'; provider.emit('chainChanged', provider.chain); await flush();
    provider.reject = { code: 4001 }; await wallet.switchNetwork();
    assert.equal(wallet.getState().status, 'wrong-network');
    assert.equal(wallet.getState().address, alice);
    assert.match(wallet.getState().error, /declined/);
    provider.reject = null; await wallet.switchNetwork();
    assert.equal(wallet.getState().error, '');
    provider.emit('disconnect', { code: 4900 }); await flush();
    assert.equal(wallet.getState().address, null);
  } finally { wallet.destroy(); delete globalThis.window; }
});

test('EIP-6963 discovery selects the requested wallet instead of window.ethereum', async () => {
  const defaultProvider = new Provider(), selected = new Provider(); browser(defaultProvider);
  selected.accounts = [bob];
  const { wallet } = service();
  try {
    await flush(); // Let Wagmi's persisted state hydrate before a late announcement.
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: {
      info: { uuid: 'f005a830-0d64-4e40-8097-49a72ac8465b', name: 'Second wallet', icon: 'data:image/svg+xml,', rdns: 'test.wallet' }, provider: selected,
    } }));
    await flush();
    assert(wallet.connectors().some(connector => connector.id === 'test.wallet'));
    await wallet.connect('test.wallet');
    assert.equal(wallet.getState().address, bob);
    assert.equal((await wallet.session()).provider, selected);
    assert(!defaultProvider.methods.includes('eth_requestAccounts'));
    await wallet.connect('injected');
    assert.equal(wallet.getState().address, alice);
    await wallet.disconnect();
    assert.equal(wallet.getState().address, null, 'Disconnect clears all restored connections');
  } finally { wallet.destroy(); delete globalThis.window; }
});

test('no provider, unavailable storage, and failed provider requests are recoverable', async () => {
  browser(); const { wallet } = service();
  try {
    assert.equal(wallet.connectors().length, 0);
    await wallet.reconnect(); assert.equal(wallet.getState().status, 'disconnected');
  } finally { wallet.destroy(); }
  const provider = new Provider(); browser(provider);
  const denied = { getItem() { throw Error('Storage denied'); }, setItem() { throw Error('Storage denied'); }, removeItem() { throw Error('Storage denied'); } };
  const next = service(denied);
  try {
    await next.wallet.connect('injected');
    assert.equal(next.wallet.getState().status, 'connected');
    await next.wallet.disconnect(); assert.equal(next.wallet.getState().address, null);
  } finally { next.wallet.destroy(); delete globalThis.window; }
  assert.match(walletError({ cause: { code: -32002 } }), /already open/);
  assert.match(walletError({ code: 4902 }), /Add it/);
  assert(!walletError(Error('private RPC URL')).includes('private RPC URL'));
});

test('trusted deployment is independent of publications and RPC is optional', () => {
  assert.equal(walletSettings({}, 'localhost').chainId, 31337);
  assert.equal(walletSettings({}, 'game.example').chainId, 1);
  assert.equal(walletSettings({}, 'localhost').rpcUrl, undefined);
  assert.throws(() => walletSettings({ wallet: { chainId: '7' } }), /Unsupported/);
  assert.throws(() => walletSettings({ wallet: { rpcUrl: 'javascript:alert(1)' } }), /HTTP/);
  assert.throws(() => assertTrustedPublication(settings, {}), /disabled/);
  const publication = { chainId: '31337', deploymentId: alice, contracts: { combat: alice, bros: bob } };
  const trusted = walletSettings({ wallet: { chainId: '31337', deployment: publication } });
  assertTrustedPublication(trusted, structuredClone(publication));
  assert.throws(() => assertTrustedPublication(trusted, { ...publication, chainId: '1' }), /configured/);
  assert.throws(() => assertTrustedPublication(trusted, { ...publication, contracts: { ...publication.contracts, bros: alice } }), /contracts/);
});
