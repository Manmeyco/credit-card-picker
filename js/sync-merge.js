// Pure helpers for syncing app state between devices through an account.

// Synced across devices. `settings` (location, radius, abroad) stays per-device.
export const SYNCED_KEYS = ['wallet', 'currencies', 'log', 'notices'];

export function syncedPart(state) {
  const out = { modifiedAt: state.modifiedAt || 0 };
  for (const k of SYNCED_KEYS) out[k] = state[k];
  return out;
}

export function applyRemote(state, remote) {
  for (const k of SYNCED_KEYS) if (remote[k] !== undefined) state[k] = remote[k];
  state.modifiedAt = remote.modifiedAt || Date.now();
}

const cardKey = (c) => c.presetId || `custom:${c.uid}`;

/** Combine this device's data with the account's data (used on first sign-in). */
export function combine(local, remote) {
  const wallet = [...(remote.wallet || [])];
  const have = new Set(wallet.map(cardKey));
  for (const c of local.wallet || []) if (!have.has(cardKey(c))) wallet.push(c);

  const seen = new Set();
  const log = [...(remote.log || []), ...(local.log || [])]
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 500);

  return {
    wallet,
    log,
    currencies: { ...(local.currencies || {}), ...(remote.currencies || {}) },
    notices: remote.notices || [],
    modifiedAt: Date.now(),
  };
}

/** Fields stored next to the state so the email job can target people. */
export function emailTargeting(state) {
  return [...new Set((state.wallet || []).map((c) => c.presetId).filter(Boolean))];
}
