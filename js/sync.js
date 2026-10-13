// Applies catalog updates to the cards in your wallet. Pure: no DOM, no storage.
//
// - Rotating quarters are always merged in (unless you edited that quarter).
// - Cards you haven't customized get updated automatically; the old version is
//   kept so the change can be undone from the app.
// - Cards you customized (via Edit) are left alone and get an "update available"
//   notice instead.

// Wallet cards added before versioning existed are treated as this version.
export const BASELINE_VERSION = '2026-10-01';

const PRESET_FIELDS = ['name', 'short', 'network', 'currency', 'color', 'base', 'rules', 'benefits', 'issuer', 'type', 'annualFee', 'foreignFee', 'verified', 'discontinued'];

export function snapshot(card) {
  const s = {};
  for (const f of PRESET_FIELDS) s[f] = structuredClone(card[f]);
  s.rotating = structuredClone(card.rotating);
  s.presetVersion = card.presetVersion;
  return s;
}

function mergeQuarters(card, preset) {
  if (!preset.rotating) return;
  if (!card.rotating) {
    card.rotating = structuredClone(preset.rotating);
    return;
  }
  for (const [q, def] of Object.entries(preset.rotating.quarters)) {
    if (!card.rotating.quarters[q]?.custom) card.rotating.quarters[q] = structuredClone(def);
  }
}

/** Overwrite a wallet card with the catalog version, keeping your own state. */
export function applyPreset(card, preset) {
  const oldRules = card.rules || [];
  for (const f of PRESET_FIELDS) {
    if (preset[f] !== undefined) card[f] = structuredClone(preset[f]);
  }
  // Keep your "pick a category" choices when they are still allowed.
  card.rules.forEach((rule, i) => {
    const prev = oldRules[i];
    if (rule.choiceOptions && prev?.choiceOptions && prev.cats?.every((c) => rule.choiceOptions.includes(c))) {
      rule.cats = prev.cats;
    }
  });
  if (preset.rotating) {
    const keepQuarters = card.rotating?.quarters || {};
    card.rotating = structuredClone(preset.rotating);
    for (const [q, def] of Object.entries(keepQuarters)) {
      if (def.custom) card.rotating.quarters[q] = def;
    }
  } else {
    delete card.rotating;
  }
  card.presetVersion = preset.version;
}

/**
 * Bring wallet cards up to date with the catalog. Mutates `wallet`.
 * @returns {Array<{ cardUid, name, version, entries, applied }>} notices to show
 */
export function syncWallet(wallet, catalog) {
  const notices = [];
  for (const card of wallet) {
    const preset = catalog.cards.find((p) => p.presetId === card.presetId);
    if (!preset) continue;
    mergeQuarters(card, preset);
    // Fill in descriptive fields added to the catalog later, without touching your edits.
    for (const f of ['issuer', 'type', 'annualFee', 'foreignFee', 'verified', 'discontinued']) {
      if (card[f] === undefined && preset[f] !== undefined) card[f] = preset[f];
    }

    const have = card.presetVersion || BASELINE_VERSION;
    if (!(preset.version > have) || card.ignoredVersion === preset.version) continue;

    const entries = preset.changelog.filter((e) => e.date > have);
    if (card.customized) {
      if (card.pendingVersion !== preset.version) {
        card.pendingVersion = preset.version;
        notices.push({ cardUid: card.uid, name: card.name, version: preset.version, entries, applied: false });
      }
      continue;
    }
    card.previous = snapshot(card);
    applyPreset(card, preset);
    notices.push({ cardUid: card.uid, name: card.name, version: preset.version, entries, applied: true });
  }
  return notices;
}

/** Undo an automatic update and stop it from re-applying. */
export function undoUpdate(card) {
  if (!card.previous) return;
  const ignored = card.presetVersion;
  Object.assign(card, structuredClone(card.previous));
  delete card.previous;
  card.ignoredVersion = ignored;
  card.customized = true;
}

/** Apply an update the user chose to accept for a customized card. */
export function acceptUpdate(card, catalog) {
  const preset = catalog.cards.find((p) => p.presetId === card.presetId);
  if (!preset) return;
  card.previous = snapshot(card);
  applyPreset(card, preset);
  card.customized = false;
  delete card.pendingVersion;
  delete card.ignoredVersion;
}

/** Keep the user's version of a customized card and stop asking about this update. */
export function declineUpdate(card) {
  card.ignoredVersion = card.pendingVersion;
  delete card.pendingVersion;
}

/** Add new currencies from the catalog and refresh their descriptions, keeping your values. */
export function syncCurrencies(currencies, catalogCurrencies = {}) {
  for (const [id, c] of Object.entries(catalogCurrencies)) {
    if (!currencies[id]) currencies[id] = structuredClone(c);
    else currencies[id] = { ...c, cpp: currencies[id].cpp };
  }
}
