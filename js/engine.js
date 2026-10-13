// Pure ranking logic. No DOM, no storage — easy to test with `node --test`.

export function quarterKey(date = new Date()) {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

// Start of the cap period containing `date` (calendar month / quarter / year).
export function periodStart(period, date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  if (period === 'month') return new Date(y, m, 1);
  if (period === 'quarter') return new Date(y, m - (m % 3), 1);
  return new Date(y, 0, 1);
}

export function capKey(card, rule, ruleIndex) {
  return `${card.uid}:${rule.cap?.group ?? ruleIndex}`;
}

export function spentInPeriod(log, key, period, date = new Date()) {
  const start = periodStart(period, date).getTime();
  const end = date.getTime() + 1;
  let total = 0;
  for (const e of log) {
    if (e.capKey === key && e.ts >= start && e.ts < end) total += Number(e.amount) || 0;
  }
  return total;
}

export function pointValue(card, currencies) {
  const c = currencies[card.currency];
  return c ? Number(c.cpp) : 1;
}

// Every way this card could earn on a purchase in `cats`, before choosing the best.
export function candidateRules(card, cats, date = new Date()) {
  const set = new Set(cats);
  const out = [];
  (card.rules || []).forEach((rule, i) => {
    if (!rule.cats?.some((c) => set.has(c))) return;
    out.push({ kind: 'rule', rate: Number(rule.rate), cap: rule.cap, key: capKey(card, rule, i), label: rule.label });
  });
  const rot = card.rotating;
  const q = quarterKey(date);
  const def = rot?.quarters?.[q];
  if (def) {
    const hit = def.cats.filter((c) => set.has(c));
    if (hit.length) {
      const rate = Math.max(...hit.map((c) => Number(def.rates?.[c] ?? def.rate)));
      out.push({
        kind: 'rotating',
        rate,
        cap: rot.cap,
        key: `${card.uid}:rot`,
        label: `Rotating ${q.slice(5)} bonus`,
        quarter: q,
        activated: !rot.activationRequired || !!card.activated?.[q],
      });
    }
  }
  return out;
}

/**
 * Score one card for a purchase.
 * @returns {{ card, pct, rate, label, capLeft, cap, notes: string[], missed?: object, blocked?: string }}
 */
export function scoreCard(card, cats, { currencies, log = [], amount = 0, date = new Date(), networks } = {}) {
  const cpp = pointValue(card, currencies);
  const base = Number(card.base) || 0;
  const amt = Number(amount) > 0 ? Number(amount) : 0;
  const notes = [];
  let best = { pct: base * cpp, rate: base, label: 'Base rate', capLeft: null, cap: null, key: null };
  let missed = null;

  for (const cand of candidateRules(card, cats, date)) {
    let capLeft = null;
    if (cand.cap) {
      capLeft = Math.max(0, cand.cap.amount - spentInPeriod(log, cand.key, cand.cap.period, date));
    }
    let effRate = cand.rate;
    if (capLeft !== null) {
      if (capLeft <= 0) effRate = base;
      else if (amt > capLeft) effRate = (capLeft * cand.rate + (amt - capLeft) * base) / amt;
    }
    const pct = effRate * cpp;
    if (cand.kind === 'rotating' && !cand.activated) {
      if (pct > best.pct) missed = { pct, label: cand.label, quarter: cand.quarter };
      continue;
    }
    if (pct > best.pct) {
      best = { pct, rate: effRate, label: cand.label || 'Category bonus', capLeft, cap: cand.cap, key: cand.key };
    }
    if (capLeft === 0) notes.push(`${cand.label || 'Bonus'} cap reached this ${cand.cap.period}`);
    else if (capLeft !== null && amt > capLeft) notes.push(`Only $${fmt(capLeft)} left at the bonus rate`);
  }

  let blocked;
  if (networks && networks.length && !networks.includes(card.network)) {
    blocked = `Not accepted here (${networks.join('/')} only)`;
  }
  if (missed && missed.pct <= best.pct) missed = null;
  return { card, ...best, notes, missed, blocked };
}

export function rankCards(cards, cats, opts = {}) {
  const scored = cards.filter((c) => !c.hidden).map((c) => scoreCard(c, cats, opts));
  scored.sort((a, b) => (!!a.blocked - !!b.blocked) || (b.pct - a.pct) || a.card.name.localeCompare(b.card.name));
  return scored;
}

// Resolve a free-text query or OSM place into categories.
export function merchantFor(text, merchants) {
  if (!text) return null;
  const t = text.trim();
  return merchants.find((m) => m.match.test(t)) || null;
}

export function fmt(n) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtPct(p) {
  return `${parseFloat(Number(p).toFixed(2))}%`;
}
