import { createConfig, createStorage, injected, connect, disconnect, reconnect,
  getAccount, watchAccount, watchConnectors, switchChain, custom, http } from '@wagmi/core';
import { mainnet, sepolia, hoodi, hardhat } from 'viem/chains';

export function createInjectedDriver(settings, storage) {
  const memory = new Map();
  const safeStorage = {
    getItem(key) { try { return storage?.getItem(key) ?? memory.get(key) ?? null; } catch { return memory.get(key) ?? null; } },
    setItem(key, value) { memory.set(key, value); try { storage?.setItem(key, value); } catch {} },
    removeItem(key) { memory.delete(key); try { storage?.removeItem(key); } catch {} },
  };
  // No default public RPC: connecting only uses the selected wallet's provider.
  const unavailable = custom({ request: async () => { throw Error('No application RPC configured.'); } });
  const chains = [mainnet, sepolia, hoodi, hardhat];
  const config = createConfig({
    chains,
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    storage: createStorage({ key: 'battlebros.wallet', storage: safeStorage }),
    transports: Object.fromEntries(chains.map(chain => [chain.id,
      chain.id === settings.chainId && settings.rpcUrl ? http(settings.rpcUrl) : unavailable])),
  });
  return {
    config,
    connection: () => getAccount(config),
    connectors: () => config.connectors.filter(connector => connector.id !== 'injected' || !!globalThis.window?.ethereum),
    watch(listener) {
      const account = watchAccount(config, { onChange: listener });
      const connectors = watchConnectors(config, { onChange: listener });
      return () => { account(); connectors(); };
    },
    connect: connector => connect(config, { connector }),
    reconnect: () => reconnect(config),
    async disconnect() {
      // Reconnect can restore more than one authorized connector. Disconnect all.
      for (const connection of [...config.state.connections.values()]) await disconnect(config, { connector: connection.connector });
    },
    switchChain: chainId => switchChain(config, { chainId }),
    provider: () => getAccount(config).connector.getProvider(),
    destroy: () => config._internal.mipd?.destroy(),
  };
}
