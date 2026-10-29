// Public configuration only. A manifest URL never grants permission to write.
export function walletSettings(runtime = {}, hostname = '') {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  const input = runtime.wallet ?? {};
  const chainId = Number(input.chainId ?? (local ? 31337 : 1));
  if (![1, 11155111, 560048, 31337].includes(chainId)) throw Error('Unsupported wallet target chain.');
  let rpcUrl;
  if (input.rpcUrl) {
    const url = new URL(input.rpcUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error('Wallet RPC must use HTTP or HTTPS.');
    if (url.username || url.password) throw Error('Do not put private RPC credentials in frontend configuration.');
    rpcUrl = url.href;
  }
  const deployment = input.deployment;
  if (deployment) {
    if (String(deployment.chainId) !== String(chainId)) throw Error('Wallet deployment chain mismatch.');
    const address = value => /^0x[0-9a-fA-F]{40}$/.test(value ?? '');
    if (!address(deployment.deploymentId) || !deployment.contracts ||
        !address(deployment.contracts.combat) ||
        deployment.deploymentId.toLowerCase() !== deployment.contracts.combat.toLowerCase() ||
        Object.values(deployment.contracts).some(value => !address(value))) throw Error('Invalid trusted wallet deployment.');
  }
  const confirmations=Number(input.confirmations??12);
  if(!Number.isInteger(confirmations)||confirmations<1||confirmations>64)throw Error('Invalid transaction confirmation count.');
  if(input.instanceId&&!/^[a-zA-Z0-9-]{1,80}$/.test(input.instanceId))throw Error('Invalid wallet instance ID.');
  if(input.anchor&&(!/^\d+$/.test(input.anchor.number)||!/^0x[0-9a-fA-F]{64}$/.test(input.anchor.hash)))throw Error('Invalid deployment anchor.');
  return { chainId, rpcUrl, deployment, confirmations, instanceId:input.instanceId, anchor:input.anchor };
}

export function assertTrustedPublication(settings, publication) {
  const trusted = settings.deployment;
  if (!trusted) throw Error('Transactions are disabled until a trusted deployment is configured. Browsing is available.');
  if (String(publication.chainId) !== String(settings.chainId) ||
      publication.deploymentId?.toLowerCase() !== trusted.deploymentId.toLowerCase()) throw Error('This publication is not the configured wallet deployment.');
  for (const [key, value] of Object.entries(publication.contracts ?? {})) {
    if (trusted.contracts[key]?.toLowerCase() !== value.toLowerCase()) throw Error('Published contracts do not match the trusted wallet deployment.');
  }
}
