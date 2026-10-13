import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffCatalogs, buildEmail } from '../scripts/card-diff.mjs';

const oldRaw = { cards: [
  { presetId: 'a', name: 'Card A', changelog: [{ date: '2026-10-01', text: 'old' }], rotating: { quarters: { '2026-Q4': { cats: ['dining'], rate: 5 } } } },
  { presetId: 'b', name: 'Card B', changelog: [] },
] };
const newRaw = { cards: [
  { presetId: 'a', name: 'Card A', changelog: [{ date: '2026-10-01', text: 'old' }, { date: '2026-11-16', text: 'Dining now 4x.' }],
    rotating: { quarters: { '2026-Q4': { cats: ['dining'], rate: 5 }, '2027-Q1': { cats: ['groceries', 'streaming'], rate: 5 } } } },
  { presetId: 'b', name: 'Card B', changelog: [], discontinued: '2026-11-16' },
  { presetId: 'c', name: 'Card C', issuer: 'Chase', changelog: [] },
] };

test('diff finds changes, new quarters, discontinuations and new cards', () => {
  const ev = diffCatalogs(oldRaw, newRaw);
  assert.deepEqual(ev.map((e) => `${e.presetId}:${e.kind}`), ['a:changed', 'a:quarter', 'b:discontinued', 'c:new']);
  assert.match(ev[1].text, /Q1 2027 5% categories: groceries, streaming/);
});

test('no changes, no events', () => {
  assert.equal(diffCatalogs(newRaw, newRaw).length, 0);
});

test('"my cards" list only gets their cards; "all" list gets everything', () => {
  const ev = diffCatalogs(oldRaw, newRaw);
  const url = 'https://x.github.io/app/';
  const mine = buildEmail(ev, { presetIds: ['a'], prefs: { emailMine: true } }, url);
  assert.match(mine.subject, /Card A/);
  assert.match(mine.text, /Dining now 4x/);
  assert.doesNotMatch(mine.text, /Card C/);
  assert.equal(buildEmail(ev, { presetIds: ['zzz'], prefs: { emailMine: true } }, url), null);
  const all = buildEmail(ev, { presetIds: ['a'], prefs: { emailAll: true } }, url);
  assert.match(all.text, /Your cards[\s\S]*Other card news[\s\S]*Card C/);
  assert.match(all.html, /\?view=settings/);
  assert.equal(buildEmail(ev, { presetIds: ['a'], prefs: {} }, url), null);
});
