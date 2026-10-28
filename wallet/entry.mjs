import { walletSettings } from './config.mjs';
import { createInjectedDriver } from './driver.mjs';
import { createWalletService } from './service.mjs';
import { mountWalletControls } from './ui.mjs';

let storage;
try { storage = window.localStorage; } catch { /* Private browsing can deny storage. */ }
const settings = walletSettings(window.__battleBrosPublicData, location.hostname);
export const wallet = createWalletService(createInjectedDriver(settings, storage), settings);
export { assertTrustedPublication } from './config.mjs';
for (const root of document.querySelectorAll('[data-wallet-controls]')) mountWalletControls(root, wallet);
// Does not ask for accounts or signatures on a fresh visit.
wallet.reconnect();
