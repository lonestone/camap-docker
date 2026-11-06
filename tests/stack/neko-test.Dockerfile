# Test-only camap-hx image: the production image + libfaketime.
#
# "neko-base" is the image built from camap-hx/camap-hx.Dockerfile, injected by
# docker-compose.test.yml (additional_contexts: neko-base: service:neko-base).
# Standalone build:
#   docker build --build-context neko-base=docker-image://camap-test-neko-base:latest \
#     -f tests/stack/neko-test.Dockerfile tests/stack
FROM neko-base

RUN apt-get update \
    && apt-get install -y --no-install-recommends libfaketime \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf "$(find /usr/lib -name libfaketime.so.1 | head -n1)" /usr/local/lib/libfaketime.so.1 \
    && test -e /usr/local/lib/libfaketime.so.1

# curl stand-in: answers Mapbox geocoding requests with a fixed point (see curl-stub.sh)
COPY curl-stub.sh /usr/local/bin/curl
RUN chmod 0755 /usr/local/bin/curl

# Apache (and therefore mod_neko) gets the fake clock, the rest of the
# container does not. The offset file holds "+0" (real time) or "+<seconds>" /
# "-<seconds>"; FAKETIME_NO_CACHE makes every time() call re-read it, so the
# clock can be moved without restarting Apache.
RUN install -d -m 0777 /faketime \
    && echo "+0" > /faketime/faketime.rc \
    && { \
      echo ''; \
      echo '# --- camap characterisation tests: libfaketime ---'; \
      echo 'export LD_PRELOAD=/usr/local/lib/libfaketime.so.1'; \
      echo 'export FAKETIME_TIMESTAMP_FILE=/faketime/faketime.rc'; \
      echo 'export FAKETIME_NO_CACHE=1'; \
      echo 'export FAKETIME_DONT_FAKE_MONOTONIC=1'; \
    } >> /etc/apache2/envvars

# To see the clock Neko sees: GET /cron prints "now is YYYY-MM-DD HH:MM:SS"
# (controller/Cron.hx constructor; doDefault runs no job).

ENV TZ=Europe/Paris
