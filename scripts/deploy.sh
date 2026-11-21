#!/usr/bin/env bash
# Deploys LayaProfile from the images CI published to Docker Hub.
#
# It pulls, starts and verifies. It never builds anything: the server runs the exact image that
# was tested in CI. Run it from anywhere; it works in the repository root (the directory above
# scripts/), where docker-compose.yml and .env live.
#
#   scripts/deploy.sh
#   LAYAPROFILE_TAG=sha-1a2b3c4 scripts/deploy.sh      # pin a version, for example a rollback
#   HEALTH_TIMEOUT=300 scripts/deploy.sh               # wait longer for the app to be healthy
#
# Environment:
#   DOCKERHUB_TOKEN     Optional. When set, the script logs in to Docker Hub first (needed for
#                       private images). It is passed to `docker login` on stdin and never printed.
#                       Export it in your shell; do not put it in .env.
#   DOCKERHUB_USERNAME  Required together with DOCKERHUB_TOKEN.
#   HEALTH_TIMEOUT      Seconds to wait for the app container to become healthy (default 120).
#
# DOCKERHUB_NAMESPACE (and the other settings) are read from .env by Docker Compose.
set -euo pipefail

HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
POLL_INTERVAL=3

log() { printf '%s\n' "$*"; }
fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

cd "$(dirname "${BASH_SOURCE[0]}")/.."

command -v docker > /dev/null 2>&1 || fail 'docker is not installed or not in PATH.'
docker compose version > /dev/null 2>&1 || fail 'The Docker Compose v2 plugin is required (docker compose).'
[[ "$HEALTH_TIMEOUT" =~ ^[0-9]+$ ]] || fail "HEALTH_TIMEOUT must be a number of seconds, got '$HEALTH_TIMEOUT'."
[[ -f .env ]] || fail 'No .env file found. Copy .env.example to .env and set DOCKERHUB_NAMESPACE.'

# Validates the compose file and its variables. A missing DOCKERHUB_NAMESPACE stops here with
# Compose's own message.
config_error=$(docker compose config --quiet 2>&1) || fail "Invalid compose configuration:
$config_error"

services=$(docker compose config --services | tr '\n' ' ')
log "Deploying services: ${services}"
case " ${services} " in
  *' laya '*) ;;
  *) log 'Laya is not enabled (COMPOSE_PROFILES has no "laya"): the app runs without model assessment.' ;;
esac

if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
  [[ -n "${DOCKERHUB_USERNAME:-}" ]] || fail 'DOCKERHUB_USERNAME must be set together with DOCKERHUB_TOKEN.'
  log 'Logging in to Docker Hub...'
  printf '%s' "$DOCKERHUB_TOKEN" | docker login --username "$DOCKERHUB_USERNAME" --password-stdin > /dev/null
fi

log 'Pulling images...'
docker compose pull
log 'Starting containers...'
docker compose up --detach --no-build --remove-orphans

container_id=$(docker compose ps --quiet app)
[[ -n "$container_id" ]] || fail 'The app container was not created.'

health_status() {
  docker inspect --format '{{if .State.Running}}{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}{{else}}not-running{{end}}' "$1"
}

log "Waiting up to ${HEALTH_TIMEOUT}s for the app to become healthy..."
waited=0
while true; do
  status=$(health_status "$container_id")
  # Only "starting" is worth waiting for; every other state is final.
  [[ "$status" == starting ]] || break
  if ((waited >= HEALTH_TIMEOUT)); then break; fi
  sleep "$POLL_INTERVAL"
  waited=$((waited + POLL_INTERVAL))
done

if [[ "$status" != healthy ]]; then
  printf 'ERROR: The app did not become healthy (status: %s after about %ss).\n' "$status" "$waited" >&2
  docker compose ps >&2 || true
  log 'Last 50 log lines of the app container:' >&2
  docker compose logs --no-color --tail=50 app >&2 || true
  if [[ " ${services} " == *' laya '* ]]; then log 'Laya problems show in: docker compose logs laya' >&2; fi
  exit 1
fi

log "OK: the app is healthy after about ${waited}s."
if [[ " ${services} " == *' laya '* ]]; then
  laya_id=$(docker compose ps --quiet laya)
  if [[ -n "$laya_id" ]]; then
    # Informational only: the first start downloads the model and may take minutes, and the app
    # works without Laya meanwhile.
    log "Laya status: $(health_status "$laya_id") (may stay 'starting' while the model downloads or loads)."
  fi
fi
docker compose ps
