import { CATEGORIES, CATEGORY_BY_ID, MERCHANTS } from './data.js';
import { loadCatalog } from './catalog.js';
import { syncWallet, syncCurrencies, undoUpdate, acceptUpdate, declineUpdate } from './sync.js';
import { rankCards, quarterKey, spentInPeriod, capKey, fmt, fmtPct } from './engine.js';
import { load, save, cardFromPreset, blankCard, newUid } from './store.js';
import { getPosition, nearbyPlaces } from './location.js';

const state = load();
let selection = null; // { title, cats, networks }
let places = [];
let catalog = { cards: [] };
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

function persist() {
  save(state);
  renderAll();
}

const catLabel = (id) => CATEGORY_BY_ID[id]?.label ?? id;
const amount = () => Number($('#amount').value) || 0;
const rankOpts = (extra = {}) => ({ currencies: state.currencies, log: state.log, amount: amount(), ...extra });

// ---------- Pick view ----------

function renderTiles() {
  const box = $('#tiles');
  box.replaceChildren();
  if (!state.wallet.length) {
    box.append(el('p', { class: 'muted' }, 'Add your cards in the Wallet tab to see recommendations.'));
    return;
  }
  for (const cat of CATEGORIES.filter((c) => !c.hidden)) {
    const [top] = rankCards(state.wallet, [cat.id, 'other'], rankOpts({ amount: 0 }));
    if (!top) continue;
    box.append(
      el('button', { class: 'tile', onclick: () => select({ title: cat.label, cats: [cat.id] }) },
        el('span', { class: 'tile-icon' }, cat.icon),
        el('span', { class: 'tile-label' }, cat.label),
        el('span', { class: 'tile-card', style: `--card:${top.card.color}` }, top.card.short || top.card.name),
        el('span', { class: 'tile-pct' }, fmtPct(top.pct), top.missed ? ' ⚠️' : ''),
      ),
    );
  }
}

function select(sel) {
  selection = sel;
  renderResult();
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderResult() {
  const box = $('#result');
  box.replaceChildren();
  if (!selection) return;
  const cats = [...selection.cats, 'other'];
  const ranked = rankCards(state.wallet, cats, rankOpts({ networks: selection.networks }));
  box.append(
    el('div', { class: 'result-head' },
      el('h2', {}, selection.title),
      el('div', { class: 'muted small' }, selection.cats.filter((c) => c !== 'other').map(catLabel).join(' · ') || 'General purchase'),
    ),
  );
  if (!ranked.length) {
    box.append(el('p', { class: 'muted' }, 'No cards yet — add some in the Wallet tab.'));
    return;
  }
  if (ranked.every((r) => r.blocked)) {
    box.append(el('p', { class: 'warn small' }, `None of your cards are accepted here (${selection.networks.join('/')} only).`));
  }
  ranked.forEach((r, i) => box.append(resultRow(r, i === 0 && !r.blocked)));
  box.append(el('button', { class: 'link', onclick: () => { selection = null; renderResult(); } }, 'Clear'));
}

function resultRow(r, isBest) {
  const c = r.card;
  const cpp = state.currencies[c.currency]?.cpp ?? 1;
  const earn = c.currency === 'cash' ? '' : ` (${+r.rate.toFixed(2)}x × ${cpp}¢)`;
  const capLine = r.cap && r.capLeft != null ? `$${fmt(r.capLeft)} of $${fmt(r.cap.amount)} left this ${r.cap.period}` : '';
  return el('div', { class: `result-row${isBest ? ' best' : ''}${r.blocked ? ' blocked' : ''}`, style: `--card:${c.color}` },
    el('div', { class: 'swatch' }),
    el('div', { class: 'grow' },
      el('div', { class: 'card-name' }, isBest ? 'Use ' : '', el('strong', {}, c.name)),
      el('div', { class: 'small muted' }, r.label + earn),
      capLine && el('div', { class: 'small muted' }, capLine),
      r.notes.map((n) => el('div', { class: 'small warn' }, n)),
      r.blocked && el('div', { class: 'small warn' }, r.blocked),
      r.perks.map((b) => el('div', { class: 'small tip' }, `💡 ${b.text}`)),
      r.missed && el('div', { class: 'small warn' },
        `Activate ${r.missed.quarter} bonus for ${fmtPct(r.missed.pct)}! `,
        el('button', { class: 'link', onclick: () => { c.activated[r.missed.quarter] = true; persist(); } }, 'I activated it'),
      ),
    ),
    el('div', { class: 'right' },
      el('div', { class: 'pct' }, fmtPct(r.pct)),
      el('button', { class: 'link small', onclick: () => logPurchase(r) }, 'log $'),
    ),
  );
}

function logPurchase(r) {
  let amt = amount();
  if (!amt) {
    const v = prompt(`Amount spent on ${r.card.name}?`);
    amt = Number(v);
    if (!amt || amt <= 0) return;
  }
  state.log.unshift({
    id: newUid(), ts: Date.now(), cardUid: r.card.uid, amount: amt,
    capKey: r.key, where: selection?.title ?? '',
  });
  state.log = state.log.slice(0, 500);
  $('#amount').value = '';
  persist();
  toast(`Logged $${fmt(amt)} on ${r.card.short || r.card.name}`);
}

function renderSuggestions() {
  const q = $('#search').value.trim().toLowerCase();
  const box = $('#suggestions');
  box.replaceChildren();
  if (!q) return;
  const hits = [];
  for (const m of MERCHANTS) {
    if (m.name.toLowerCase().includes(q) || m.match.test(q)) hits.push({ title: m.name, cats: m.cats, networks: m.networks });
  }
  for (const c of CATEGORIES) {
    if (!c.hidden && c.label.toLowerCase().includes(q)) hits.push({ title: c.label, cats: [c.id] });
  }
  hits.push({ title: `"${$('#search').value.trim()}" (everything else)`, cats: ['other'] });
  hits.slice(0, 8).forEach((h) => box.append(el('button', { class: 'chip', onclick: () => { $('#search').value = ''; box.replaceChildren(); select(h); } }, h.title)));
}

async function locate() {
  const status = $('#locateStatus');
  const box = $('#places');
  box.replaceChildren();
  status.textContent = 'Getting your location…';
  try {
    const pos = await getPosition();
    status.textContent = `Looking up stores near you (±${Math.round(pos.accuracy)} m)…`;
    places = await nearbyPlaces(pos.latitude, pos.longitude, Math.max(state.settings.radius, Math.min(pos.accuracy, 300)));
    if (!places.length) {
      status.textContent = 'No stores found nearby. Search or pick a category below.';
      return;
    }
    status.textContent = 'Nearest first — tap the right one if it guessed wrong:';
    places.forEach((p, i) => box.append(
      el('button', { class: `chip${i === 0 ? ' on' : ''}`, onclick: (e) => {
        box.querySelectorAll('.chip').forEach((b) => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
        select({ title: p.name, cats: p.cats, networks: p.networks });
      } }, `${p.name} · ${p.distance}m`),
    ));
    const p = places[0];
    select({ title: p.name, cats: p.cats, networks: p.networks });
  } catch (e) {
    status.textContent = e.message || String(e);
  }
}

// ---------- Wallet view ----------

function renderWallet() {
  const box = $('#walletList');
  box.replaceChildren();
  if (!state.wallet.length) box.append(el('p', { class: 'muted' }, 'No cards yet.'));
  const q = quarterKey();
  for (const card of state.wallet) {
    const cur = state.currencies[card.currency];
    const parts = [];
    const rot = card.rotating;
    const def = rot?.quarters?.[q];
    if (rot) {
      if (def) {
        const spent = spentInPeriod(state.log, `${card.uid}:rot`, rot.cap.period);
        parts.push(el('div', { class: 'rot' },
          el('div', {}, el('strong', {}, `${q} ${def.rate}%: `), def.cats.map((c) => catLabel(c) + (def.rates?.[c] ? ` (${def.rates[c]}%)` : '')).join(', ')),
          rot.activationRequired && el('label', { class: 'row' },
            el('input', { type: 'checkbox', checked: !!card.activated?.[q], onchange: (e) => { card.activated ??= {}; card.activated[q] = e.target.checked; persist(); } }),
            card.activated?.[q] ? ' Activated' : ' Not activated yet — tick once you activate',
          ),
          progress(spent, rot.cap.amount, rot.cap.period),
        ));
      } else {
        parts.push(el('div', { class: 'warn small' }, `No rotating categories entered for ${q}. Tap Edit to add them.`));
      }
    }
    card.rules.forEach((rule, i) => {
      if (rule.choiceOptions) {
        parts.push(el('label', { class: 'row small' }, `${rule.label || 'Your pick'} (${rule.rate}${card.currency === 'cash' ? '%' : 'x'}): `,
          el('select', { onchange: (e) => { rule.cats = [e.target.value]; persist(); } },
            rule.choiceOptions.map((o) => el('option', { value: o, selected: rule.cats[0] === o }, catLabel(o)))),
        ));
      }
      if (rule.cap && !(i > 0 && card.rules.slice(0, i).some((r) => r.cap?.group && r.cap.group === rule.cap.group))) {
        const spent = spentInPeriod(state.log, capKey(card, rule, i), rule.cap.period);
        parts.push(el('div', { class: 'small' }, `${rule.cats.map(catLabel).join(', ')} cap:`, progress(spent, rule.cap.amount, rule.cap.period)));
      }
    });
    box.append(el('div', { class: 'wallet-card', style: `--card:${card.color}` },
      el('div', { class: 'wallet-head' },
        el('div', { class: 'swatch' }),
        el('div', { class: 'grow' },
          el('strong', {}, card.name),
          el('div', { class: 'small muted' }, `${cur?.name ?? card.currency}${card.currency === 'cash' ? '' : ` @ ${cur?.cpp}¢`} · base ${card.base}${card.currency === 'cash' ? '%' : 'x'} · ${card.network}`),
        ),
        el('button', { class: 'link', onclick: () => editCard(card) }, 'Edit'),
      ),
      card.pendingVersion && el('div', { class: 'small update' },
        'An update is available for this card, but you have edited it. ',
        el('button', { class: 'link', onclick: () => { acceptUpdate(card, catalog); persist(); } }, 'Use the update'),
        el('button', { class: 'link', onclick: () => { declineUpdate(card); persist(); } }, 'Keep mine'),
      ),
      parts,
      card.benefits?.length > 0 && el('details', { class: 'benefits small' },
        el('summary', {}, `Benefits (${card.benefits.length})`),
        el('ul', {}, card.benefits.map((b) => el('li', {}, b.text))),
      ),
    ));
  }
  renderLog();
}

function progress(spent, cap, period) {
  const pct = Math.min(100, (spent / cap) * 100);
  return el('div', { class: 'progress-wrap' },
    el('div', { class: 'progress' }, el('div', { style: `width:${pct}%` })),
    el('span', { class: 'small muted' }, `$${fmt(spent)} / $${fmt(cap)} this ${period}`),
  );
}

function renderLog() {
  const box = $('#logList');
  box.replaceChildren();
  if (!state.log.length) {
    box.append(el('p', { class: 'muted small' }, 'Nothing logged yet. Tap "log $" on a recommendation.'));
    return;
  }
  for (const e of state.log.slice(0, 30)) {
    const card = state.wallet.find((c) => c.uid === e.cardUid);
    box.append(el('div', { class: 'log-row small' },
      el('span', { class: 'grow' }, `${new Date(e.ts).toLocaleDateString()} · ${card?.short || card?.name || 'Removed card'} · ${e.where}`),
      el('strong', {}, `$${fmt(e.amount)}`),
      el('button', { class: 'link', onclick: () => { state.log = state.log.filter((x) => x.id !== e.id); persist(); } }, '✕'),
    ));
  }
}

// ---------- Dialogs ----------

function openDialog(build, onSave) {
  const dlg = $('#dialog');
  const body = $('#dialogBody');
  body.replaceChildren(...build().flat(Infinity));
  dlg.onclose = () => { if (dlg.returnValue === 'save') onSave?.(); };
  dlg.returnValue = '';
  dlg.showModal();
}

function addCardDialog() {
  const owned = new Set(state.wallet.map((c) => c.presetId));
  openDialog(() => [
    el('h2', {}, 'Add a card'),
    el('div', { class: 'preset-list' },
      catalog.cards.filter((p) => !owned.has(p.presetId)).map((p) =>
        el('button', { type: 'button', class: 'preset', style: `--card:${p.color}`, onclick: () => {
          state.wallet.push(cardFromPreset(p));
          $('#dialog').close();
          persist();
          toast(`Added ${p.name}. Check its numbers with Edit.`);
        } }, el('span', { class: 'swatch' }), p.name)),
    ),
    el('div', { class: 'btn-row' },
      el('button', { type: 'button', onclick: () => { $('#dialog').close(); editCard(blankCard(), true); } }, 'Custom card…'),
      el('button', { value: 'cancel' }, 'Close'),
    ),
  ]);
}

function catPicker(selected, onChange) {
  const set = new Set(selected);
  const summary = el('summary', {}, selected.length ? selected.map(catLabel).join(', ') : 'Pick categories');
  return el('details', { class: 'cat-picker' }, summary,
    el('div', { class: 'cat-grid' }, CATEGORIES.filter((c) => c.id !== 'other').map((c) =>
      el('label', {}, el('input', { type: 'checkbox', checked: set.has(c.id), onchange: (e) => {
        e.target.checked ? set.add(c.id) : set.delete(c.id);
        const arr = [...set];
        summary.textContent = arr.length ? arr.map(catLabel).join(', ') : 'Pick categories';
        onChange(arr);
      } }), ` ${c.label}`))),
  );
}

function editCard(card, isNew = false) {
  const d = structuredClone(card);
  const field = (label, input) => el('label', { class: 'field' }, el('span', {}, label), input);
  const bind = (key, type = 'text') => el('input', { type, value: d[key] ?? '', step: 'any', oninput: (e) => { d[key] = type === 'number' ? Number(e.target.value) : e.target.value; } });

  const build = () => [
    el('h2', {}, isNew ? 'New card' : 'Edit card'),
    field('Name', bind('name')),
    field('Short name', bind('short')),
    field('Color', bind('color', 'color')),
    field('Network', el('select', { onchange: (e) => { d.network = e.target.value; } },
      ['visa', 'mastercard', 'amex', 'discover'].map((n) => el('option', { value: n, selected: d.network === n }, n)))),
    field('Rewards currency', el('select', { onchange: (e) => { d.currency = e.target.value; } },
      Object.entries(state.currencies).map(([id, c]) => el('option', { value: id, selected: d.currency === id }, `${c.name} (${c.cpp}¢)`)))),
    field('Base rate (% or x)', bind('base', 'number')),

    el('h3', {}, 'Bonus categories'),
    d.rules.map((rule, i) => el('div', { class: 'rule' },
      rule.choiceOptions
        ? el('div', { class: 'small muted' }, `${rule.label || 'Choice'}: pick in Wallet`)
        : catPicker(rule.cats, (arr) => { rule.cats = arr; }),
      el('div', { class: 'rule-nums' },
        field('Rate', el('input', { type: 'number', step: 'any', value: rule.rate, oninput: (e) => { rule.rate = Number(e.target.value); } })),
        field('Cap $', el('input', { type: 'number', step: 'any', value: rule.cap?.amount ?? '', placeholder: 'none', oninput: (e) => {
          const v = Number(e.target.value);
          if (v > 0) rule.cap = { period: 'year', ...rule.cap, amount: v };
          else delete rule.cap;
        } })),
        field('per', el('select', { onchange: (e) => { if (rule.cap) rule.cap.period = e.target.value; } },
          ['month', 'quarter', 'year'].map((p) => el('option', { value: p, selected: (rule.cap?.period ?? 'year') === p }, p)))),
      ),
      el('button', { type: 'button', class: 'link warn', onclick: () => { d.rules.splice(i, 1); rerender(); } }, 'Remove'),
    )),
    el('button', { type: 'button', onclick: () => { d.rules.push({ cats: [], rate: 2 }); rerender(); } }, '＋ Bonus category'),

    el('h3', {}, 'Rotating quarterly categories'),
    el('label', { class: 'row' }, el('input', { type: 'checkbox', checked: !!d.rotating, onchange: (e) => {
      d.rotating = e.target.checked ? { activationRequired: true, cap: { amount: 1500, period: 'quarter' }, quarters: {} } : undefined;
      rerender();
    } }), ' This card has rotating categories'),
    d.rotating && [
      el('label', { class: 'row' }, el('input', { type: 'checkbox', checked: d.rotating.activationRequired, onchange: (e) => { d.rotating.activationRequired = e.target.checked; } }), ' Must activate each quarter'),
      field('Quarterly cap $', el('input', { type: 'number', value: d.rotating.cap.amount, oninput: (e) => { d.rotating.cap.amount = Number(e.target.value); } })),
      Object.entries(d.rotating.quarters).sort(([a], [b]) => b.localeCompare(a)).map(([q, def]) => el('div', { class: 'rule' },
        el('strong', {}, q),
        catPicker(def.cats, (arr) => { def.cats = arr; def.custom = true; }),
        field('Rate', el('input', { type: 'number', step: 'any', value: def.rate, oninput: (e) => { def.rate = Number(e.target.value); def.custom = true; } })),
        def.rates && el('div', { class: 'small muted' }, 'Special rates: ' + Object.entries(def.rates).map(([c, r]) => `${catLabel(c)} ${r}`).join(', ')),
        el('button', { type: 'button', class: 'link warn', onclick: () => { delete d.rotating.quarters[q]; rerender(); } }, 'Remove quarter'),
      )),
      el('button', { type: 'button', onclick: () => {
        const q = prompt('Quarter (e.g. 2027-Q1)', nextQuarter(d.rotating.quarters));
        if (q && /^\d{4}-Q[1-4]$/.test(q)) { d.rotating.quarters[q] ??= { cats: [], rate: 5, custom: true }; rerender(); }
      } }, '＋ Quarter'),
    ],

    el('div', { class: 'btn-row sticky' },
      !isNew && el('button', { type: 'button', class: 'warn', onclick: () => {
        if (!confirm(`Remove ${card.name} from your wallet?`)) return;
        state.wallet = state.wallet.filter((c) => c.uid !== card.uid);
        $('#dialog').close();
        persist();
      } }, 'Delete'),
      el('button', { value: 'cancel', formnovalidate: true }, 'Cancel'),
      el('button', { value: 'save', class: 'primary' }, 'Save'),
    ),
  ];
  const rerender = () => $('#dialogBody').replaceChildren(...build().flat(Infinity));
  openDialog(() => build().flat(Infinity), () => {
    if (!d.rotating) delete d.rotating;
    const fields = (c) => JSON.stringify(['name', 'network', 'currency', 'base', 'rules'].map((f) => c[f]));
    if (d.presetId && fields(d) !== fields(card)) d.customized = true;
    const i = state.wallet.findIndex((c) => c.uid === d.uid);
    if (i >= 0) state.wallet[i] = d;
    else state.wallet.push(d);
    persist();
  });
}

function nextQuarter(quarters) {
  const keys = Object.keys(quarters).sort();
  const last = keys.at(-1) || quarterKey();
  let [y, q] = [Number(last.slice(0, 4)), Number(last.slice(-1))];
  if (keys.length) { q += 1; if (q > 4) { q = 1; y += 1; } }
  return `${y}-Q${q}`;
}

// ---------- Settings ----------

function renderSettings() {
  const box = $('#currencyList');
  box.replaceChildren();
  for (const [id, c] of Object.entries(state.currencies)) {
    box.append(el('div', { class: 'currency' },
      el('label', { class: 'row' },
        el('span', { class: 'grow' }, c.name),
        el('input', { type: 'number', step: '0.05', min: '0', value: c.cpp, disabled: c.locked, onchange: (e) => { c.cpp = Number(e.target.value); persist(); } }),
        ' ¢/pt',
      ),
      c.note && el('div', { class: 'small muted' }, c.note),
    ));
  }
  box.append(el('button', { onclick: () => {
    const name = prompt('Currency name (e.g. "Bilt points")');
    if (!name) return;
    const cpp = Number(prompt('Cents per point to you', '1'));
    state.currencies[`c_${newUid()}`] = { name, cpp: cpp || 1 };
    persist();
  } }, '＋ Add currency'));
  $('#catalogInfo').textContent = catalog.updated
    ? `Card data from ${catalog.updated}. Last checked ${state.lastChecked ? new Date(state.lastChecked).toLocaleString() : 'never'}.`
    : 'Card data has not loaded yet (are you offline?).';
  $('#autoLocate').checked = state.settings.autoLocate;
  $('#radius').value = state.settings.radius;
}

// ---------- Shell ----------

function renderNotices() {
  const box = $('#updates');
  box.replaceChildren();
  state.notices ??= [];
  for (const n of state.notices) {
    const card = state.wallet.find((c) => c.uid === n.cardUid);
    if (!card) continue;
    const dismiss = () => { state.notices = state.notices.filter((x) => x !== n); persist(); };
    box.append(el('div', { class: 'notice', style: `--card:${card.color}` },
      el('div', { class: 'grow' },
        el('strong', {}, n.applied ? `${card.name} updated` : `Update available: ${card.name}`),
        n.entries.length
          ? n.entries.map((e) => el('div', { class: 'small' }, e.text))
          : el('div', { class: 'small muted' }, 'Card details refreshed.'),
        el('div', {},
          n.applied && card.previous && el('button', { class: 'link small', onclick: () => { undoUpdate(card); dismiss(); toast('Change undone'); } }, 'Undo'),
          !n.applied && card.pendingVersion && [
            el('button', { class: 'link small', onclick: () => { acceptUpdate(card, catalog); dismiss(); } }, 'Use the update'),
            el('button', { class: 'link small', onclick: () => { declineUpdate(card); dismiss(); } }, 'Keep mine'),
          ],
        ),
      ),
      el('button', { class: 'link', 'aria-label': 'Dismiss', onclick: dismiss }, '✕'),
    ));
  }
}

async function refreshCatalog({ manual = false } = {}) {
  try {
    const res = await loadCatalog();
    catalog = res.catalog;
    syncCurrencies(state.currencies, catalog.currencies);
    const notices = syncWallet(state.wallet, catalog);
    state.notices = [...(state.notices || []), ...notices];
    if (res.fresh) state.lastChecked = Date.now();
    persist();
    if (manual) toast(notices.length ? `${notices.length} card update(s)` : res.fresh ? 'Your cards are up to date' : 'Offline — using saved card data');
  } catch {
    if (manual) toast('Could not check for updates');
    renderAll();
  }
}

function renderAll() {
  $('#quarterBadge').textContent = quarterKey();
  renderNotices();
  renderTiles();
  renderResult();
  renderWallet();
  renderSettings();
}

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2500);
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
$('#locateBtn').addEventListener('click', locate);
$('#search').addEventListener('input', renderSuggestions);
$('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#suggestions .chip')?.click(); });
$('#amount').addEventListener('input', renderResult);
$('#addCardBtn').addEventListener('click', addCardDialog);
$('#autoLocate').addEventListener('change', (e) => { state.settings.autoLocate = e.target.checked; save(state); });
$('#radius').addEventListener('change', (e) => { state.settings.radius = Number(e.target.value) || 120; save(state); });
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `card-picker-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!Array.isArray(data.wallet)) throw new Error('Not a Card Picker backup');
    if (!confirm('Replace everything on this phone with the backup?')) return;
    Object.assign(state, data);
    persist();
    toast('Backup restored');
  } catch (err) {
    alert(`Import failed: ${err.message}`);
  }
});

$('#checkUpdatesBtn').addEventListener('click', () => refreshCatalog({ manual: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - (state.lastChecked || 0) > CHECK_EVERY_MS) refreshCatalog();
});

renderAll();
await refreshCatalog();
if (!state.wallet.length) showView('wallet');
const params = new URLSearchParams(location.search);
if (params.get('view')) showView(params.get('view'));
if (params.has('locate') || (state.settings.autoLocate && state.wallet.length)) locate();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
