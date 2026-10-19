// "Where am I?" — phone GPS + OpenStreetMap (Overpass API, free, no key).
import { MERCHANTS, MERCHANT_BY_ID, OSM_TAG_CATEGORIES } from './data.js';
import { merchantFor } from './engine.js';

// Store lookup services, tried in order. All use OpenStreetMap data.
// Photon is fast and reliable; the public Overpass servers are often
// overloaded (run the "Check map services" GitHub Action to see current state).
const PHOTON = 'https://photon.komoot.io/reverse';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const CONNECTIVITY_PROBE = 'https://www.gstatic.com/generate_204';
const PLACES_CACHE_KEY = 'pick-a-card:places';

function tryPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, options);
  });
}

export async function getPosition() {
  if (!navigator.geolocation) throw new Error('This browser does not support location.');
  try {
    return await tryPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  } catch (e) {
    if (e.code === 1) throw new Error('Location permission is off for this app. Turn it on in your browser or phone settings.');
    // A precise fix can take long indoors; accept a rougher or recent one instead.
    try {
      return await tryPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 });
    } catch (e2) {
      if (e2.code === 1) throw new Error('Location permission is off for this app. Turn it on in your browser or phone settings.');
      throw new Error(e2.code === 3
        ? "Your phone didn't report a location within 20 seconds."
        : "Your phone couldn't work out its location (it reported \"position unavailable\"). Check that Location is on.");
    }
  }
}

export function overpassQuery(lat, lon, r) {
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

/** Fetch JSON, describing exactly how it failed. */
async function getJson(url, options = {}, timeoutMs = 8000) {
  const started = Date.now();
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new Error(`no answer within ${Math.round(timeoutMs / 1000)} s`);
    // Browsers report refused connections, DNS failures and error pages without
    // CORS headers identically, so this is as specific as a web app can be.
    throw new Error(`request failed after ${((Date.now() - started) / 1000).toFixed(1)} s (server unreachable or returned an error)`);
  }
  if (!res.ok) throw new Error(`server error ${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new Error('sent back something that was not map data');
  }
}

export function photonToTags(feature) {
  const p = feature.properties || {};
  const tags = { name: p.name };
  if (p.osm_key && p.osm_value) tags[p.osm_key] = p.osm_value;
  const [lon, lat] = feature.geometry?.coordinates || [];
  return { tags, lat, lon };
}

const SOURCES = [
  {
    name: 'Photon',
    async lookup(lat, lon, radius) {
      const params = new URLSearchParams({ lat, lon, limit: 25, radius: Math.max(0.05, radius / 1000).toFixed(3) });
      for (const t of ['shop', 'amenity', 'tourism', 'leisure', 'aeroway']) params.append('osm_tag', t);
      const json = await getJson(`${PHOTON}?${params}`);
      return (json.features || []).map(photonToTags);
    },
  },
  {
    name: 'Overpass',
    async lookup(lat, lon, radius) {
      const errors = [];
      for (const url of OVERPASS) {
        try {
          const json = await getJson(url, { method: 'POST', body: new URLSearchParams({ data: overpassQuery(lat, lon, radius) }) }, 10000);
          return (json.elements || []).map((el) => ({ tags: el.tags || {}, lat: el.lat ?? el.center?.lat, lon: el.lon ?? el.center?.lon }));
        } catch (e) {
          errors.push(`${new URL(url).host}: ${e.message}`);
        }
      }
      throw new Error(errors.join('; '));
    },
  },
  {
    name: 'Nominatim',
    async lookup(lat, lon) {
      const json = await getJson(`${NOMINATIM}?${new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: 18, extratags: 1, namedetails: 1 })}`);
      if (!json || json.error || !json.category) return [];
      return [{ tags: { ...(json.extratags || {}), name: json.name, [json.category]: json.type }, lat: Number(json.lat), lon: Number(json.lon) }];
    },
  },
];

async function internetWorks() {
  try {
    await fetch(CONNECTIVITY_PROBE, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return true;
  } catch {
    return false;
  }
}

export class LookupError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

/** Turn what happened into an accurate message. Pure, for testing. */
export function explainFailure({ online, internet, attempts, radius }) {
  const details = attempts.map((a) => `${a.name}: ${a.error || `found ${a.count} place(s), none usable`}`).join(' · ');
  if (online === false) return new LookupError('Your phone is offline (no Wi-Fi or mobile data), so stores nearby can\'t be looked up.', details);
  if (internet === false) return new LookupError("Your phone couldn't reach the internet just now (a test request to Google also failed), so stores nearby can't be looked up.", details);
  if (attempts.some((a) => !a.error)) return new LookupError(`No stores are on the map within ${Math.round(radius)} m of you. Search for the store or tap a category instead.`, details);
  return new LookupError('The map services that list nearby stores aren\'t answering right now. Your internet connection is working.', details);
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

export function toPlaces(raw, lat, lon) {
  const seen = new Set();
  const places = [];
  for (const { tags, lat: plat, lon: plon } of raw) {
    if (plat == null || plon == null) continue;
    const p = classifyTags(tags);
    if (p.name === '(unnamed)' && p.cats[0] === 'other') continue;
    const dedupe = `${p.name}|${p.cats.join()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    places.push({ ...p, lat: plat, lon: plon, distance: Math.round(distanceM(lat, lon, plat, plon)) });
  }
  return places.sort((a, b) => a.distance - b.distance).slice(0, 12);
}

/** @returns {Promise<{ places, source }>} or throws LookupError with an accurate reason. */
export async function nearbyPlaces(lat, lon, radius = 120) {
  const attempts = [];
  for (const source of SOURCES) {
    try {
      const raw = await source.lookup(lat, lon, radius);
      const places = toPlaces(raw, lat, lon);
      attempts.push({ name: source.name, count: raw.length });
      if (places.length) {
        rememberPlaces(lat, lon, places);
        return { places, source: source.name };
      }
    } catch (e) {
      attempts.push({ name: source.name, error: e.message });
    }
  }
  const online = navigator.onLine;
  const internet = online === false ? false : await internetWorks();
  throw explainFailure({ online, internet, attempts, radius });
}

// Rough bounding boxes for the US, Alaska, Hawaii and Puerto Rico.
const US_BOXES = [
  [24.4, 49.5, -125, -66.9],
  [51, 72, -180, -129],
  [18.5, 22.5, -161, -154],
  [17.8, 18.6, -67.5, -65.2],
];
export const inUS = (lat, lon) => US_BOXES.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
