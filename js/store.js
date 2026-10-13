// Persistent state in localStorage. Everything stays on the phone.
import { CURRENCIES, PRESETS } from './data.js';

const KEY = 'card-picker:v1';

function defaults() {
  return {
    wallet: [],
    currencies: structuredClone(CURRENCIES),
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
  // Keep user-edited point values but pick up any new currencies.
  s.currencies = { ...d.currencies, ...(s.currencies || {}) };
  // Pull in newly published rotating quarters for preset cards, without
  // overwriting quarters the user has edited.
  for (const card of s.wallet) {
    const preset = PRESETS.find((p) => p.presetId === card.presetId);
    if (preset?.rotating && card.rotating) {
      for (const [q, def] of Object.entries(preset.rotating.quarters)) {
        card.rotating.quarters[q] ??= structuredClone(def);
      }
    }
  }
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
  return { ...structuredClone(preset), uid: newUid(), activated: {} };
}

export function blankCard() {
  return {
    uid: newUid(), presetId: null, name: 'My card', short: 'My card', network: 'visa',
    currency: 'cash', color: '#555555', base: 1, rules: [], activated: {},
  };
}
