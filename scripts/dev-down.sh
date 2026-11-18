#!/usr/bin/env bash
# Stop the local stack.
#
# Usage: scripts/dev-down.sh [--volumes]
#   --volumes also deletes the local Postgres, MinIO and sandbox data.

source "$(dirname "$0")/lib/common.sh"
require_command docker

cd "$DEPLOYMENT_DIR"
COMPOSE_FILES=(-f docker-compose.infra.yml -f docker-compose.local.yml)

# The repo-root .env is this machine's local overrides - ports, LLM keys.
# Everything in the local stack has a default, so it is optional.
if [[ -f "$REPO_ROOT/.env" ]]; then
    COMPOSE_FILES+=(--env-file "$REPO_ROOT/.env")
    set -a; source "$REPO_ROOT/.env"; set +a
fi

if [[ "${1:-}" == "--volumes" ]]; then
    warn "removing local volumes - all local data will be deleted"
    docker compose "${COMPOSE_FILES[@]}" down -v
else
    docker compose "${COMPOSE_FILES[@]}" down
    log "local data volumes preserved - pass --volumes to delete them"
fi
