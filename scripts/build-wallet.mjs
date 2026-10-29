import { build } from 'esbuild';
await build({
  entryPoints: ['wallet/entry.mjs'], outfile: 'build/wallet.js', bundle: true,
  format: 'esm', target: ['es2022'], minify: true, legalComments: 'eof',
  external:['./transactions.js'],
});
for(const [source,output] of [['wallet/transactions.mjs','transactions'],['wallet/local-harness.mjs','local-harness']]){
  await build({entryPoints:[source],outfile:`build/${output}.js`,bundle:true,format:'esm',target:['es2022'],minify:true,legalComments:'eof',external:['./wallet.js']});
}
console.log('Wallet bundle built (injected connectors only).');
