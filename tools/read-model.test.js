const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('  const BATTLEBROS_UINT_PATTERN');
const end = html.indexOf('  function formatBattleBrosUnits', start);
if (start < 0 || end < 0) throw new Error('Could not extract BattleBros read-model normalizer.');

const context = vm.createContext({ Object, Array, BigInt, Error, String });
vm.runInContext(html.slice(start, end) + '\nthis.normalize = normalizeBattleBrosPublicDocuments;', context);

const fixture = relative => JSON.parse(fs.readFileSync(path.join(root, 'assets', 'mock-public', relative), 'utf8'));
const manifest = fixture('manifest.json');
const game = fixture('current/game-state.json');
const bro = fixture('current/battle-bros/12.json');

const model = context.normalize(manifest, game, bro, 12n);
assert.strictEqual(model.identity.tokenId, 12n);
assert.strictEqual(model.progression.xp, 540n);
assert.strictEqual(model.progression.reserves.attack, 64n);
assert.strictEqual(model.training.weightsBps.attack, 6000n);
assert.strictEqual(model.mint.inputAmount, 100000000000000000n);
assert.strictEqual(model.mint.paidWithETH, true);
assert.strictEqual(model.capital.totalShares, 104495000000000000n);
assert.strictEqual(model.currentRound.id, 9n);
assert.strictEqual(model.roundHistory.length, 1);
assert.strictEqual(model.roundHistory[0].outcome, 'WIN');
assert.strictEqual(model.roundHistory[0].reserveChanges[0].combatType, 'ATTACK');
assert.strictEqual(model.roundHistory[0].reserveChanges[0].amount, 5n);

const wrongSnapshot = structuredClone(bro);
wrongSnapshot.snapshot.blockNumber = '23847193';
assert.throws(() => context.normalize(manifest, game, wrongSnapshot, 12n), /different confirmed snapshots/);

const excessReserves = structuredClone(bro);
excessReserves.progression.reserves.attack = '1000';
assert.throws(() => context.normalize(manifest, game, excessReserves, 12n), /exceed total capacity/);

const leakedNeedRound = structuredClone(bro);
leakedNeedRound.need = { active: false, sinceRound: '9' };
assert.throws(() => context.normalize(manifest, game, leakedNeedRound, 12n), /Inactive Need/);

const invalidMintPaymentType = structuredClone(bro);
invalidMintPaymentType.mint.paidWithETH = 'true';
assert.throws(() => context.normalize(manifest, game, invalidMintPaymentType, 12n), /paidWithETH must be boolean/);

console.log('read-model: normalization and cross-document invariants OK');
