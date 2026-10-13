import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, CURRENCIES, MERCHANTS } from '../js/data.js';
import { rankCards, scoreCard, quarterKey, merchantFor } from '../js/engine.js';
import { classifyTags } from '../js/location.js';

const card = (id, extra = {}) => ({ ...structuredClone(PRESETS.find((p) => p.presetId === id)), uid: id, activated: {}, ...extra });
const Q4 = new Date(2026, 10, 15); // Nov 15 2026
const opts = (o = {}) => ({ currencies: structuredClone(CURRENCIES), log: [], date: Q4, ...o });

test('quarterKey', () => {
  assert.equal(quarterKey(new Date(2026, 9, 13)), '2026-Q4');
  assert.equal(quarterKey(new Date(2027, 0, 1)), '2027-Q1');
});

test('GM points are valued low, so GM card does not win everyday spend', () => {
  const wallet = [card('my_gm_rewards'), card('citi_double_cash')];
  const [top, second] = rankCards(wallet, ['other'], opts());
  assert.equal(top.card.presetId, 'citi_double_cash');
  assert.equal(top.pct, 2);
  assert.equal(second.pct, 1); // 4x * 0.25¢
});

test('GM card still wins if you value GM points highly', () => {
  const o = opts();
  o.currencies.gm.cpp = 1;
  const [top] = rankCards([card('my_gm_rewards'), card('citi_double_cash')], ['other'], o);
  assert.equal(top.card.presetId, 'my_gm_rewards');
});

test('Discover rotating 5% applies only when activated', () => {
  const d = card('discover_it');
  const wallet = [d, card('citi_double_cash')];
  let [top] = rankCards(wallet, ['dining'], opts());
  assert.equal(top.card.presetId, 'citi_double_cash');
  const dScore = scoreCard(d, ['dining'], opts());
  assert.equal(dScore.missed.pct, 5);

  d.activated['2026-Q4'] = true;
  [top] = rankCards(wallet, ['dining'], opts());
  assert.equal(top.card.presetId, 'discover_it');
  assert.equal(top.pct, 5);
});

test('Rotating bonus is not applied outside its quarter', () => {
  const d = card('discover_it', { activated: { '2026-Q4': true } });
  const s = scoreCard(d, ['dining'], opts({ date: new Date(2027, 1, 1) }));
  assert.equal(s.pct, 1);
});

test('Rotating cap: exhausted cap falls back, partial cap blends', () => {
  const d = card('discover_it', { activated: { '2026-Q4': true } });
  const log = [{ capKey: 'discover_it:rot', amount: 1400, ts: new Date(2026, 9, 5).getTime() }];
  const partial = scoreCard(d, ['dining'], opts({ log, amount: 200 }));
  assert.equal(partial.pct, (100 * 5 + 100 * 1) / 200);
  log.push({ capKey: 'discover_it:rot', amount: 100, ts: new Date(2026, 9, 6).getTime() });
  assert.equal(scoreCard(d, ['dining'], opts({ log })).pct, 1);
  // Spend from the previous quarter doesn't count.
  const old = [{ capKey: 'discover_it:rot', amount: 1500, ts: new Date(2026, 8, 30).getTime() }];
  assert.equal(scoreCard(d, ['dining'], opts({ log: old })).pct, 5);
});

test('Freedom Flex Q4 dining is 7x, falls back to 3x after cap', () => {
  const f = card('freedom_flex', { activated: { '2026-Q4': true } });
  assert.equal(scoreCard(f, ['dining'], opts()).pct, 7);
  const log = [{ capKey: 'freedom_flex:rot', amount: 1500, ts: new Date(2026, 9, 2).getTime() }];
  assert.equal(scoreCard(f, ['dining'], opts({ log })).pct, 3);
});

test('Network restriction: Amex blocked at Costco', () => {
  const costco = merchantFor('Costco Wholesale', MERCHANTS);
  const ranked = rankCards([card('amex_gold'), card('costco_citi')], [...costco.cats, 'other'], opts({ networks: costco.networks }));
  assert.equal(ranked[0].card.presetId, 'costco_citi');
  assert.ok(ranked[1].blocked);
});

test('Choice categories (Custom Cash) follow the pick', () => {
  const c = card('citi_custom_cash');
  assert.equal(scoreCard(c, ['dining'], opts()).pct, 5);
  c.rules[0].cats = ['gas'];
  assert.equal(scoreCard(c, ['dining'], opts()).pct, 1);
  assert.equal(scoreCard(c, ['gas'], opts()).pct, 5);
});

test('OSM classification', () => {
  assert.deepEqual(classifyTags({ shop: 'supermarket', name: 'Kroger' }).cats, ['groceries']);
  assert.deepEqual(classifyTags({ shop: 'department_store', name: 'Target', brand: 'Target' }).cats, ['target']);
  assert.deepEqual(classifyTags({ amenity: 'restaurant', name: "Joe's Diner" }).cats, ['dining']);
  assert.deepEqual(classifyTags({ amenity: 'fuel', brand: 'Costco', name: 'Costco Gasoline' }).cats.sort(), ['costco', 'gas']);
  assert.deepEqual(classifyTags({ shop: 'car', name: 'Smith Chevrolet' }).cats, ['gm', 'auto_service']);
  assert.deepEqual(classifyTags({ shop: 'wholesale', brand: 'Costco' }).cats, ['wholesale', 'costco']);
});
