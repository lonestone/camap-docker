#!/bin/sh
# Test-only stand-in for curl, installed as /usr/local/bin/curl (ahead of /usr/bin in PATH).
# camap-hx calls curl as an external process (sugoi.apis.linux.Curl). The Mapbox geocoder
# (service/Mapbox.hx) would hit the real api.mapbox.com with the fake token "test" and always
# fail ("Not Authorized - Invalid Token"), which rolls back group creation and place edits.
# Geocoding requests are answered here with a fixed point (Rennes), or with no result when the
# address contains "NOWHERE". Everything else goes to the real curl.
case "$*" in
  *api.mapbox.com/geocoding*NOWHERE*)
    echo '{"type":"FeatureCollection","features":[{"place_type":["address"],"geometry":{"type":"Point","coordinates":[null,null]}}]}'
    exit 0 ;;
  *api.mapbox.com/geocoding*)
    echo '{"type":"FeatureCollection","features":[{"place_type":["address"],"geometry":{"type":"Point","coordinates":[-1.6778,48.1173]}}]}'
    exit 0 ;;
esac
exec /usr/bin/curl "$@"
