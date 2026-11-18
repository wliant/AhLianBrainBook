#!/usr/bin/env bash
# Start the local stack: throwaway infrastructure plus the app built from
# source. Same shape as dev and prod - one port, API same-origin at /api.
#
# Usage: scripts/dev-up.sh

source "$(dirname "$0")/lib/common.sh"
require_command docker

cd "$DEPLOYMENT_DIR"

# One invocation so both files share the brainbook-local project and neither
# is treated as the other's orphan.
COMPOSE_FILES=(-f docker-compose.infra.yml -f docker-compose.local.yml)

# The repo-root .env is this machine's local overrides - ports, LLM keys.
# Everything in the local stack has a default, so it is optional.
if [[ -f "$REPO_ROOT/.env" ]]; then
    COMPOSE_FILES+=(--env-file "$REPO_ROOT/.env")
    set -a; source "$REPO_ROOT/.env"; set +a
fi

log "building and starting the local stack"
docker compose "${COMPOSE_FILES[@]}" up -d --build --wait

WEB_PORT="${WEB_PORT:-13000}"
APP_PORT="${APP_PORT:-18080}"
log "app:  http://localhost:$WEB_PORT"
log "api:  http://localhost:$WEB_PORT/actuator/health  (same origin, through the proxy)"
log "direct api (debugging only): http://127.0.0.1:$APP_PORT/actuator/health"
