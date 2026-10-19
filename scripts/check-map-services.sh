#!/usr/bin/env bash
# Sends the app's real store-lookup request to each map service, the way a
# browser on manmeyco.github.io would, and reports what comes back.
# Run by .github/workflows/check-maps.yml (Actions tab → Check map services).
LAT=${LAT:-40.7505}; LON=${LON:--73.9934}   # a dense block in Manhattan
ORIGIN=${ORIGIN:-https://manmeyco.github.io}
Q="[out:json][timeout:10];(nwr(around:120,$LAT,$LON)[shop][name];nwr(around:120,$LAT,$LON)[amenity~\"^(restaurant|fast_food|cafe|pharmacy|fuel)\$\"];);out center tags 60;"

for url in https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter https://overpass.kumi.systems/api/interpreter https://maps.mail.ru/osm/tools/overpass/api/interpreter; do
  echo "=== $url"
  echo "-- CORS preflight-free POST (what the app sends):"
  curl -sS -m 25 -o /tmp/body -D /tmp/headers -w 'status=%{http_code} time=%{time_total}s\n' \
    -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/credit-card-picker/" \
    --data-urlencode "data=$Q" "$url" || echo "curl failed (exit $?)"
  grep -i '^access-control-allow-origin' /tmp/headers || echo "(no Access-Control-Allow-Origin header: a browser would report 'Failed to fetch')"
  head -c 300 /tmp/body | tr '\n' ' '; echo; echo
done

echo "=== Nominatim reverse geocode (fallback)"
curl -sS -m 20 -o /tmp/body -D /tmp/headers -w 'status=%{http_code} time=%{time_total}s\n' \
  -H "Origin: $ORIGIN" -H "Referer: $ORIGIN/credit-card-picker/" \
  "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=$LAT&lon=$LON&zoom=18&extratags=1"
grep -i '^access-control-allow-origin' /tmp/headers || echo "(no CORS header)"
head -c 400 /tmp/body; echo
