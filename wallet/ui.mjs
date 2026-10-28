const names = { 1: 'Ethereum', 11155111: 'Sepolia', 560048: 'Hoodi', 31337: 'Local development' };
export function mountWalletControls(root, wallet) {
  root.classList.add('bb-wallet');
  root.innerHTML = `<details><summary>Connect wallet</summary><div class="bb-wallet-panel">
    <p class="bb-wallet-status" role="status" aria-live="polite"></p>
    <p class="bb-wallet-address"></p>
    <label>Browser wallet<select aria-label="Browser wallet"></select></label>
    <div class="bb-wallet-actions"><button type="button" data-action="connect">Connect</button>
    <button type="button" data-action="switch" hidden>Switch network</button>
    <button type="button" data-action="disconnect" hidden>Disconnect</button>
    <button type="button" data-action="refresh">Refresh wallets</button></div>
    <p class="bb-wallet-note">Connecting does not authorize transactions or editing.</p>
    <p class="bb-wallet-error" role="alert" hidden></p>
  </div></details>`;
  const find = selector => root.querySelector(selector);
  const details = find('details'), select = find('select'), summary = find('summary');
  function render(state) {
    const chosen = select.value;
    const options = wallet.connectors();
    select.replaceChildren(...options.map(connector => {
      const option = document.createElement('option');
      option.value = connector.id; option.textContent = connector.name; return option;
    }));
    if (options.some(option => option.id === chosen)) select.value = chosen;
    const connected = !!state.address;
    summary.textContent = connected ? `${state.address.slice(0, 6)}…${state.address.slice(-4)}` : state.busy ? 'Connecting…' : 'Connect wallet';
    find('.bb-wallet-status').textContent = state.busy ? 'Waiting for wallet…' : connected
      ? state.status === 'wrong-network' ? `Switch to ${names[wallet.settings.chainId]} to use wallet actions.` : `Connected · ${names[state.chainId]}`
      : options.length ? `Not connected · Target: ${names[wallet.settings.chainId]}` : 'No browser wallet found. Install or unlock an Ethereum wallet, then refresh.';
    find('.bb-wallet-address').textContent = state.address ?? '';
    find('.bb-wallet-address').hidden = !connected;
    select.parentElement.hidden = connected || !options.length;
    for (const button of root.querySelectorAll('button')) button.disabled = state.busy;
    select.disabled = state.busy;
    find('[data-action="connect"]').hidden = connected;
    find('[data-action="connect"]').disabled = state.busy || !options.length;
    find('[data-action="switch"]').hidden = state.status !== 'wrong-network';
    find('[data-action="disconnect"]').hidden = !connected;
    find('[data-action="refresh"]').hidden = connected;
    find('.bb-wallet-error').hidden = !state.error;
    find('.bb-wallet-error').textContent = state.error;
  }
  const unsubscribe = wallet.subscribe(render);
  function releaseGameInput() {
    if (document.pointerLockElement) document.exitPointerLock?.();
    document.dispatchEvent(new CustomEvent('battlebros:wallet-open'));
  }
  details.addEventListener('toggle', () => { if (details.open) { releaseGameInput(); render(wallet.getState()); } });
  root.addEventListener('focusin', releaseGameInput);
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape' && details.open) { details.open = false; summary.focus(); }
  });
  for (const event of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup', 'wheel']) {
    root.addEventListener(event, e => e.stopPropagation());
  }
  root.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'connect') wallet.connect(select.value);
    if (action === 'switch') wallet.switchNetwork();
    if (action === 'disconnect') wallet.disconnect();
    if (action === 'refresh') { wallet.clearError(); render(wallet.getState()); }
  });
  return unsubscribe;
}
