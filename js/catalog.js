// Loads the card catalog (data/cards.json). The catalog is updated on the
// server (see UPDATING.md), and the app re-checks it every time it opens.
import { CATEGORY_ALIASES } from './data.js';

const CACHE_KEY = 'card-picker:catalog';

const expand = (cats = []) => cats.flatMap((c) => CATEGORY_ALIASES[c] ?? [c]);

export function normalizeCatalog(raw) {
  const cards = raw.cards.map((c) => ({
    ...c,
    rules: (c.rules || []).map((r) => ({
      ...r,
      cats: expand(r.cats),
      ...(r.choiceOptions ? { choiceOptions: expand(r.choiceOptions) } : {}),
    })),
    rotating: c.rotating && {
      ...c.rotating,
      quarters: Object.fromEntries(Object.entries(c.rotating.quarters || {}).map(([q, d]) => [q, { ...d, cats: expand(d.cats) }])),
    },
    benefits: (c.benefits || []).map((b) => ({ ...b, cats: expand(b.cats) })),
    changelog: c.changelog || [],
  }));
  return { ...raw, cards };
}

function cached() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

/** Returns { catalog, fresh } — fresh is false when we fell back to the cached copy. */
export async function loadCatalog() {
  try {
    const res = await fetch(`data/cards.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    const raw = await res.json();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch { /* storage full */ }
    return { catalog: normalizeCatalog(raw), fresh: true };
  } catch (e) {
    const raw = cached();
    if (raw) return { catalog: normalizeCatalog(raw), fresh: false };
    throw e;
  }
}
