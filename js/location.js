// "Where am I?" — phone GPS + OpenStreetMap (Overpass API, free, no key).
import { MERCHANTS, MERCHANT_BY_ID, OSM_TAG_CATEGORIES } from './data.js';
import { merchantFor } from './engine.js';

// Public Overpass servers. The one that last worked is tried first.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const GOOD_ENDPOINT_KEY = 'pick-a-card:overpass';
const PLACES_CACHE_KEY = 'pick-a-card:places';
const REQUEST_TIMEOUT_MS = 9000;

function tryPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, options);
  });
}

export async function getPosition() {
  if (!navigator.geolocation) throw new Error('This browser has no location support.');
  try {
    return await tryPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  } catch (e) {
    if (e.code === 1) throw new Error('Location permission is off for this app. Turn it on in your browser settings.');
    // Indoors GPS often times out; accept a rougher or recent fix instead.
    try {
      return await tryPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 });
    } catch {
      throw new Error('Could not get your location (weak GPS indoors?).');
    }
  }
}

function overpassQuery(lat, lon, r) {
  const a = `(around:${r},${lat},${lon})`;
  return `[out:json][timeout:10];(
nwr${a}[shop][name];
nwr${a}[amenity~"^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|fuel|charging_station|pharmacy|cinema|theatre|car_rental|nightclub)$"];
nwr${a}[leisure~"^(fitness_centre|sports_centre|bowling_alley|amusement_arcade|water_park|stadium|miniature_golf)$"][name];
nwr${a}[tourism~"^(zoo|aquarium|theme_park|museum|hotel|motel)$"];
nwr${a}[aeroway=terminal];
);out center tags 60;`;
}

function storageGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export class LookupError extends Error {}

async function fetchOverpass(query) {
  const preferred = storageGet(GOOD_ENDPOINT_KEY);
  const order = [...ENDPOINTS].sort((a, b) => (b === preferred) - (a === preferred));
  for (const url of order) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal: ctrl.signal });
      if (!res.ok) continue;
      const json = await res.json();
      storageSet(GOOD_ENDPOINT_KEY, url);
      return json;
    } catch {
      // Network error, timeout, or a busy server without CORS headers: try the next one.
    } finally {
      clearTimeout(timer);
    }
  }
  throw new LookupError(navigator.onLine === false
    ? "You're offline, so the store lookup can't run."
    : "Couldn't reach the map service. Signal inside stores is often weak.");
}

// ---- Remembered lookups, so places you've been work without signal ----

export function cachedPlacesNear(lat, lon, within = 150) {
  const cache = storageGet(PLACES_CACHE_KEY) || [];
  let best = null;
  for (const entry of cache) {
    const d = distanceM(lat, lon, entry.lat, entry.lon);
    if (d <= within && (!best || d < best.d)) best = { d, entry };
  }
  if (!best) return null;
  // Re-measure distances from where you are now.
  return best.entry.places
    .map((p) => ({ ...p, distance: Math.round(distanceM(lat, lon, p.lat, p.lon)) }))
    .sort((a, b) => a.distance - b.distance);
}

function rememberPlaces(lat, lon, places) {
  if (!places.length) return;
  const cache = (storageGet(PLACES_CACHE_KEY) || []).filter((e) => distanceM(lat, lon, e.lat, e.lon) > 60);
  cache.unshift({ lat, lon, ts: Date.now(), places });
  storageSet(PLACES_CACHE_KEY, cache.slice(0, 60));
}

function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function classifyTags(tags) {
  const label = tags.name || tags.brand || tags.operator || '';
  let merchant = merchantFor(tags.brand, MERCHANTS) || merchantFor(tags.name, MERCHANTS);
  // A store brand's gas station (e.g. Costco) maps to its gas merchant (Costco Gas).
  if (merchant && tags.amenity === 'fuel' && MERCHANT_BY_ID[`${merchant.id}_gas`]) merchant = MERCHANT_BY_ID[`${merchant.id}_gas`];
  let cats = [];
  for (const [k, re, c] of OSM_TAG_CATEGORIES) {
    if (tags[k] && re.test(tags[k])) {
      cats = c;
      break;
    }
  }
  if (merchant) {
    cats = merchant.cats;
    // A warehouse club's gas station is a gas purchase, not a warehouse one.
    if (tags.amenity === 'fuel') cats = ['gas', ...cats.filter((c) => c !== 'gas' && c !== 'wholesale')];
  }
  if (!cats.length) cats = ['other'];
  return { name: label || '(unnamed)', cats, networks: merchant?.networks, merchant: merchant?.name };
}

export async function nearbyPlaces(lat, lon, radius = 120) {
  const data = await fetchOverpass(overpassQuery(lat, lon, radius));
  const seen = new Set();
  const places = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const plat = el.lat ?? el.center?.lat;
    const plon = el.lon ?? el.center?.lon;
    if (plat == null) continue;
    const p = classifyTags(tags);
    if (p.name === '(unnamed)' && p.cats[0] === 'other') continue;
    const dedupe = `${p.name}|${p.cats.join()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    places.push({ ...p, lat: plat, lon: plon, distance: Math.round(distanceM(lat, lon, plat, plon)) });
  }
  places.sort((a, b) => a.distance - b.distance);
  const top = places.slice(0, 12);
  rememberPlaces(lat, lon, top);
  return top;
}

// Rough bounding boxes for the US, Alaska, Hawaii and Puerto Rico.
const US_BOXES = [
  [24.4, 49.5, -125, -66.9],
  [51, 72, -180, -129],
  [18.5, 22.5, -161, -154],
  [17.8, 18.6, -67.5, -65.2],
];
export const inUS = (lat, lon) => US_BOXES.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
