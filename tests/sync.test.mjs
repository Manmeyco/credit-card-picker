import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncWallet, undoUpdate, acceptUpdate, declineUpdate, syncCurrencies } from '../js/sync.js';
import { cardFromPreset } from '../js/store.js';

const v1 = {
  presetId: 'x', name: 'X Card', short: 'X', network: 'visa', currency: 'cash', color: '#000', base: 1, version: '2026-10-01',
  rules: [{ cats: ['dining'], rate: 3 }, { cats: ['gas'], rate: 5, choiceOptions: ['gas', 'groceries'] }],
  benefits: [], changelog: [],
  rotating: { activationRequired: true, cap: { amount: 1500, period: 'quarter' }, quarters: { '2026-Q4': { cats: ['dining'], rate: 5 } } },
};
const v2 = {
  ...structuredClone(v1), version: '2026-11-01',
  rules: [{ cats: ['dining'], rate: 4 }, { cats: ['gas'], rate: 5, choiceOptions: ['gas', 'groceries'] }],
  benefits: [{ text: 'TSA PreCheck credit' }],
  changelog: [{ date: '2026-11-01', text: 'Dining now 4x; added TSA PreCheck credit' }],
};
v2.rotating.quarters['2027-Q1'] = { cats: ['groceries'], rate: 5 };

test('auto-applies to unedited cards, keeps your picks and activations, can undo', () => {
  const c = cardFromPreset(v1);
  c.rules[1].cats = ['groceries'];
  c.activated['2026-Q4'] = true;
  const wallet = [c];
  const notices = syncWallet(wallet, { cards: [v2] });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].applied, true);
  assert.equal(notices[0].entries[0].text, 'Dining now 4x; added TSA PreCheck credit');
  assert.equal(c.rules[0].rate, 4);
  assert.deepEqual(c.rules[1].cats, ['groceries']);
  assert.equal(c.activated['2026-Q4'], true);
  assert.ok(c.rotating.quarters['2027-Q1']);
  assert.equal(c.benefits[0].text, 'TSA PreCheck credit');

  // Running again is a no-op.
  assert.equal(syncWallet(wallet, { cards: [v2] }).length, 0);

  undoUpdate(c);
  assert.equal(c.rules[0].rate, 3);
  assert.equal(c.benefits.length, 0);
  assert.equal(syncWallet(wallet, { cards: [v2] }).length, 0, 'undone update must not re-apply');
});

test('customized cards get a notice instead of an overwrite', () => {
  const c = cardFromPreset(v1);
  c.rules[0].rate = 9;
  c.customized = true;
  const notices = syncWallet([c], { cards: [v2] });
  assert.equal(notices[0].applied, false);
  assert.equal(c.rules[0].rate, 9);
  assert.ok(c.rotating.quarters['2027-Q1'], 'new rotating quarters still arrive');
  assert.equal(syncWallet([c], { cards: [v2] }).length, 0, 'only notified once');

  acceptUpdate(c, { cards: [v2] });
  assert.equal(c.rules[0].rate, 4);
  assert.equal(c.customized, false);
});

test('declining an update keeps your version', () => {
  const c = cardFromPreset(v1);
  c.customized = true;
  syncWallet([c], { cards: [v2] });
  declineUpdate(c);
  assert.equal(c.rules[0].rate, 3);
  assert.equal(syncWallet([c], { cards: [v2] }).length, 0);
});

test('quarters you edited are not overwritten', () => {
  const c = cardFromPreset(v1);
  c.rotating.quarters['2026-Q4'] = { cats: ['gas'], rate: 5, custom: true };
  syncWallet([c], { cards: [v2] });
  assert.deepEqual(c.rotating.quarters['2026-Q4'].cats, ['gas']);
});

test('rotating corrections reach cards even without a version bump', () => {
  const c = cardFromPreset(v1);
  const fixed = structuredClone(v1);
  fixed.rotating.quarters['2026-Q4'].cats = ['dining', 'utilities'];
  syncWallet([c], { cards: [fixed] });
  assert.deepEqual(c.rotating.quarters['2026-Q4'].cats, ['dining', 'utilities']);
});

test('currencies: new ones added, your values kept', () => {
  const mine = { gm: { name: 'GM', cpp: 0.1 } };
  syncCurrencies(mine, { gm: { name: 'GM Rewards points', cpp: 0.25, note: 'n' }, bilt: { name: 'Bilt', cpp: 1.5 } });
  assert.equal(mine.gm.cpp, 0.1);
  assert.equal(mine.gm.note, 'n');
  assert.equal(mine.bilt.cpp, 1.5);
});
