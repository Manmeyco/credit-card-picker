// "Where am I?" — phone GPS + OpenStreetMap (Overpass API, free, no key).
import { MERCHANTS, OSM_TAG_CATEGORIES } from './data.js';
import { merchantFor } from './engine.js';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser has no location support.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied.' : 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

function overpassQuery(lat, lon, r) {
  const a = `(around:${r},${lat},${lon})`;
  return `[out:json][timeout:15];(
nwr${a}[shop][name];
nwr${a}[amenity~"^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|fuel|charging_station|pharmacy|cinema|theatre|car_rental|nightclub)$"];
nwr${a}[leisure~"^(fitness_centre|sports_centre|bowling_alley|amusement_arcade|water_park|stadium|miniature_golf)$"][name];
nwr${a}[tourism~"^(zoo|aquarium|theme_park|museum|hotel|motel)$"];
nwr${a}[aeroway=terminal];
);out center tags 60;`;
}

async function fetchOverpass(query) {
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }) });
      if (!res.ok) throw new Error(`Map lookup failed (${res.status})`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
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
  const merchant = merchantFor(tags.brand, MERCHANTS) || merchantFor(tags.name, MERCHANTS);
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
    places.push({ ...p, distance: Math.round(distanceM(lat, lon, plat, plon)) });
  }
  places.sort((a, b) => a.distance - b.distance);
  return places.slice(0, 12);
}

// Rough bounding boxes for the US, Alaska, Hawaii and Puerto Rico.
const US_BOXES = [
  [24.4, 49.5, -125, -66.9],
  [51, 72, -180, -129],
  [18.5, 22.5, -161, -154],
  [17.8, 18.6, -67.5, -65.2],
];
export const inUS = (lat, lon) => US_BOXES.some(([a, b, c, d]) => lat >= a && lat <= b && lon >= c && lon <= d);
