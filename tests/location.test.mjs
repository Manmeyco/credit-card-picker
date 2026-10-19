import { test } from 'node:test';
import assert from 'node:assert/strict';
import { photonToTags, toPlaces, explainFailure } from '../js/location.js';

test('Photon results become classified places, nearest first', () => {
  const features = [
    { properties: { osm_key: 'amenity', osm_value: 'fast_food', name: "Dunkin'" }, geometry: { coordinates: [-73.9930, 40.7507] } },
    { properties: { osm_key: 'amenity', osm_value: 'pharmacy', name: 'CVS Pharmacy' }, geometry: { coordinates: [-73.9934, 40.7505] } },
  ];
  const places = toPlaces(features.map(photonToTags), 40.7505, -73.9934);
  assert.equal(places[0].name, 'CVS Pharmacy');
  assert.ok(places[0].cats.includes('drugstore'));
  assert.ok(places[1].cats.includes('dining'));
});

test('error messages say what actually happened', () => {
  const down = [{ name: 'Photon', error: 'server error 500' }, { name: 'Overpass', error: 'no answer within 10 s' }];
  assert.match(explainFailure({ online: false, internet: false, attempts: down, radius: 120 }).message, /offline/);
  assert.match(explainFailure({ online: true, internet: false, attempts: down, radius: 120 }).message, /couldn't reach the internet/);
  const services = explainFailure({ online: true, internet: true, attempts: down, radius: 120 });
  assert.match(services.message, /map services .* aren't answering.*internet connection is working/);
  assert.match(services.details, /Photon: server error 500 · Overpass: no answer within 10 s/);
  const empty = explainFailure({ online: true, internet: true, attempts: [{ name: 'Photon', count: 0 }, { name: 'Overpass', error: 'x' }], radius: 120 });
  assert.match(empty.message, /No stores are on the map within 120 m/);
});
