// Validates data/cards.json. The scheduled update routine must keep these passing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORY_BY_ID, CATEGORY_ALIASES, isCategory } from '../js/data.js';
import { normalizeCatalog } from '../js/catalog.js';

const raw = JSON.parse(readFileSync(new URL('../data/cards.json', import.meta.url)));
const catalog = normalizeCatalog(raw);
const DATE = /^\d{4}-\d{2}-\d{2}(\.\d+)?$/;
const NETWORKS = ['visa', 'mastercard', 'amex', 'discover'];
const PERIODS = ['month', 'quarter', 'year'];

const validCats = (cats, where) => {
  assert.ok(Array.isArray(cats) && cats.length, `${where}: needs categories`);
  for (const c of cats) assert.ok(isCategory(c), `${where}: unknown category "${c}" (valid: ${Object.keys(CATEGORY_BY_ID).join(', ')}, ${Object.keys(CATEGORY_ALIASES).join(', ')}, or m:<merchant id> from MERCHANTS in js/data.js)`);
};

test('catalog header', () => {
  assert.equal(raw.schema, 1);
  assert.match(raw.updated, DATE);
  for (const c of catalog.cards) assert.ok(raw.updated >= c.version.slice(0, 10), `"updated" must be >= every card version (${c.presetId})`);
  for (const [id, c] of Object.entries(raw.currencies)) {
    assert.ok(c.name, `currency ${id} needs a name`);
    assert.ok(typeof c.cpp === 'number' && c.cpp >= 0, `currency ${id} needs a numeric cpp`);
  }
});

test('preset ids are unique', () => {
  const ids = catalog.cards.map((c) => c.presetId);
  assert.equal(new Set(ids).size, ids.length);
});

for (const c of catalog.cards) {
  test(`card ${c.presetId}`, () => {
    const w = c.presetId;
    for (const f of ['name', 'short', 'color']) assert.ok(typeof c[f] === 'string' && c[f], `${w}: ${f}`);
    assert.ok(NETWORKS.includes(c.network), `${w}: network`);
    assert.ok(typeof c.issuer === 'string' && c.issuer, `${w}: issuer`);
    assert.ok(['credit', 'debit'].includes(c.type), `${w}: type must be credit or debit`);
    if (c.annualFee != null) assert.ok(c.annualFee >= 0, `${w}: annualFee`);
    if (c.foreignFee != null) assert.ok(c.foreignFee >= 0 && c.foreignFee < 10, `${w}: foreignFee`);
    if (c.verified) assert.match(c.verified, DATE, `${w}: verified`);
    if (c.discontinued) assert.match(c.discontinued, DATE, `${w}: discontinued must be a date`);
    assert.ok(raw.currencies[c.currency], `${w}: unknown currency ${c.currency}`);
    assert.ok(typeof c.base === 'number' && c.base >= 0, `${w}: base`);
    assert.match(c.version, DATE, `${w}: version`);
    c.rules.forEach((r, i) => {
      validCats(r.cats, `${w} rule ${i}`);
      assert.ok(typeof r.rate === 'number' && r.rate > 0, `${w} rule ${i}: rate`);
      if (r.until) assert.match(r.until, DATE, `${w} rule ${i}: until`);
      if (r.cap) {
        assert.ok(r.cap.amount > 0, `${w} rule ${i}: cap amount`);
        assert.ok(PERIODS.includes(r.cap.period), `${w} rule ${i}: cap period`);
      }
      if (r.choiceOptions) {
        validCats(r.choiceOptions, `${w} rule ${i} choiceOptions`);
        for (const x of r.cats) assert.ok(r.choiceOptions.includes(x), `${w} rule ${i}: default pick must be in choiceOptions`);
      }
    });
    if (c.rotating) {
      assert.ok(c.rotating.cap.amount > 0 && PERIODS.includes(c.rotating.cap.period), `${w}: rotating cap`);
      for (const [q, d] of Object.entries(c.rotating.quarters)) {
        assert.match(q, /^\d{4}-Q[1-4]$/, `${w}: quarter key`);
        validCats(d.cats, `${w} ${q}`);
        assert.ok(d.rate > 0, `${w} ${q}: rate`);
        for (const k of Object.keys(d.rates || {})) assert.ok(d.cats.includes(k), `${w} ${q}: rates key ${k} must be in cats`);
      }
    }
    for (const b of c.benefits) {
      assert.ok(b.text, `${w}: benefit text`);
      if (b.cats?.length) validCats(b.cats, `${w} benefit`);
    }
    for (const e of c.changelog) {
      assert.match(e.date, DATE, `${w}: changelog date`);
      assert.ok(e.date <= c.version, `${w}: changelog entry newer than card version`);
      assert.ok(e.text, `${w}: changelog text`);
    }
  });
}
