// Persistent state in localStorage. Everything stays on the phone.

const KEY = 'card-picker:v1';

function defaults() {
  return {
    wallet: [],
    currencies: {}, // filled from data/cards.json
    log: [],
    settings: { autoLocate: false, radius: 120 },
  };
}

export function load() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    s = null;
  }
  const d = defaults();
  if (!s) return d;
  s.wallet ??= [];
  s.log ??= [];
  s.settings = { ...d.settings, ...(s.settings || {}) };
  s.currencies ??= {};
  return s;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save', e);
  }
}

export function newUid() {
  return Math.random().toString(36).slice(2, 10);
}

export function cardFromPreset(preset) {
  const { changelog, version, ...rest } = structuredClone(preset);
  return { ...rest, uid: newUid(), activated: {}, presetVersion: version };
}

export function blankCard() {
  return {
    uid: newUid(), presetId: null, name: 'My card', short: 'My card', network: 'visa',
    currency: 'cash', color: '#555555', base: 1, rules: [], activated: {},
  };
}
