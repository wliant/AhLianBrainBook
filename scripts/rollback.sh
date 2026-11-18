#!/usr/bin/env bash
# Redeploy an already-pushed tag without rebuilding. The escape hatch when a
# release misbehaves: the previous images are still in the registry.
#
# Usage: scripts/rollback.sh <dev|prod> <image-tag>

source "$(dirname "$0")/lib/common.sh"
require_command ssh curl

[[ $# -eq 2 ]] || die "usage: $(basename "$0") <dev|prod> <image-tag>"
load_env "$1"
IMAGE_TAG="$2"
require_env REGISTRY IMAGE_TAG SSH_USER DEPLOY_HOST DEPLOY_DIR WEB_PORT

if [[ "$ENV_NAME" == "prod" ]]; then
    warn "about to roll PROD back to tag $IMAGE_TAG"
    confirm_or_abort "Type 'rollback prod' to continue: " "rollback prod"
fi

COMPOSE_CMD="docker compose --env-file '.env.$ENV_NAME' -f '$COMPOSE_FILE'"
log "rolling $ENV_NAME back to $IMAGE_TAG"
ssh_run "cd '$DEPLOY_DIR' \
    && IMAGE_TAG='$IMAGE_TAG' $COMPOSE_CMD pull \
    && IMAGE_TAG='$IMAGE_TAG' $COMPOSE_CMD up -d --remove-orphans"

for attempt in $(seq 1 36); do
    if ssh_run "curl -fsS http://localhost:$WEB_PORT/actuator/health" 2>/dev/null \
            | grep -q '"status":"UP"'; then
        log "rollback complete: $ENV_NAME is UP on tag $IMAGE_TAG"
        exit 0
    fi
    sleep 5
done
die "service did not report healthy within 180s after rollback"
