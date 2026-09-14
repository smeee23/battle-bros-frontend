const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
const expectations = [
  ['BattleBros title', /<title>BattleBros<\/title>/],
  ['migration mode', /const BATTLEBROS_MIGRATION_MODE = true/],
  ['BattleBro adapter', /function setBattleBroFrontendState\(/],
  ['BattleBro public transport', /async function hydrateBattleBrosReadModel\(/],
  ['deployment runtime config', /<script src="runtime-config\.js"><\/script>/],
  ['BattleBro bigint normalizer', /function normalizeBattleBrosPublicDocuments\(/],
  ['mint principal adapter', /originalPrincipalAmount: formatBattleBrosUnits\(model\.mint\.inputAmount\)/],
  ['resource-neutral tool lookup', /function resourceRuleForTool\(tool\) \{\s*if \(BATTLEBROS_MIGRATION_MODE\) return null;/],
  ['resource-neutral catalog mutation', /function applyCatalogCellMutation\(x, z, opts\) \{\s*if \(BATTLEBROS_MIGRATION_MODE\) return setCell\(x, z, opts\);/],
  ['snapshot boot isolation', /if \(!BATTLEBROS_MIGRATION_MODE\) \{[\s\S]*hydratePlayerGameContext/],
  ['Three.js r128', /vendor\/three\/three\.r128\.min\.js/],
  ['minimap', /id="minimap-canvas"/],
];

for (const [label, pattern] of expectations) {
  if (!pattern.test(html)) throw new Error(`Smoke check failed: ${label}`);
}
if (/<title>[^<]*(?:Ether\s*Wars|Tiny World)/i.test(html)) {
  throw new Error('Legacy branding remains in the document title.');
}

console.log('smoke: BattleBros shell, renderer foundation, and legacy isolation OK');
