import { build } from 'esbuild';
await build({
  entryPoints: ['wallet/entry.mjs'], outfile: 'build/wallet.js', bundle: true,
  format: 'esm', target: ['es2022'], minify: true, legalComments: 'eof',
});
console.log('Wallet bundle built (injected connectors only).');
