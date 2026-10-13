import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine, syncedPart, applyRemote, emailTargeting } from '../js/sync-merge.js';

test('combine keeps both wallets without duplicates and merges logs', () => {
  const local = { wallet: [{ uid: 'a', presetId: 'discover_it' }, { uid: 'b', presetId: null }], log: [{ id: 1, ts: 1 }, { id: 2, ts: 5 }], currencies: { gm: { cpp: 0.1 } } };
  const remote = { wallet: [{ uid: 'z', presetId: 'discover_it' }, { uid: 'y', presetId: 'amex_gold' }], log: [{ id: 2, ts: 5 }, { id: 3, ts: 3 }], currencies: { gm: { cpp: 0.3 } } };
  const out = combine(local, remote);
  assert.deepEqual(out.wallet.map((c) => c.uid), ['z', 'y', 'b']);
  assert.deepEqual(out.log.map((e) => e.id), [2, 3, 1]);
  assert.equal(out.currencies.gm.cpp, 0.3);
});

test('settings stay per-device', () => {
  const state = { wallet: [1], currencies: {}, log: [], notices: [], settings: { abroad: true }, modifiedAt: 5 };
  const part = syncedPart(state);
  assert.equal(part.settings, undefined);
  const other = { wallet: [], currencies: {}, log: [], notices: [], settings: { abroad: false } };
  applyRemote(other, part);
  assert.deepEqual(other.wallet, [1]);
  assert.equal(other.settings.abroad, false);
});

test('email targeting lists preset ids', () => {
  assert.deepEqual(emailTargeting({ wallet: [{ presetId: 'a' }, { presetId: null }, { presetId: 'a' }] }), ['a']);
});
