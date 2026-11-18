#!/usr/bin/env bash
# Build, push, and start BrainBook in a target environment.
#
# Everything happens from this machine over SSH. Do not log into the target to
# run any of these steps by hand - if something is missing, add it here.
#
# Usage: scripts/deploy.sh <dev|prod> [image-tag] [--allow-dirty]

source "$(dirname "$0")/lib/common.sh"
require_command docker ssh scp git curl

ALLOW_DIRTY=false
ARGS=()
for arg in "$@"; do
    case "$arg" in
        --allow-dirty) ALLOW_DIRTY=true ;;
        *) ARGS+=("$arg") ;;
    esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

[[ $# -ge 1 ]] || die "usage: $(basename "$0") <dev|prod> [image-tag] [--allow-dirty]"
load_env "$1"
IMAGE_TAG="$(resolve_image_tag "${2:-}")"
export IMAGE_TAG

# Checked here rather than discovered at startup: without them the stack does
# not boot, and the health poll below would only fail after the images were
# already built and pushed.
require_env REGISTRY IMAGE_TAG SSH_USER DEPLOY_HOST DEPLOY_DIR WEB_PORT \
    SPRING_DATASOURCE_URL SPRING_DATASOURCE_PASSWORD SANDBOX_DATABASE_URL \
    MINIO_ENDPOINT MINIO_ACCESS_KEY MINIO_SECRET_KEY

if [[ "$ENV_NAME" == "prod" ]]; then
    [[ "$ALLOW_DIRTY" == true ]] || require_clean_tree
    warn "about to deploy brainbook/* :$IMAGE_TAG to PROD at $DEPLOY_HOST:$DEPLOY_DIR (port $WEB_PORT)"
    confirm_or_abort "Type 'deploy prod' to continue: " "deploy prod"
fi

log "[1/5] building images"
"$(dirname "$0")/build.sh" "$IMAGE_TAG"

log "[2/5] pushing to $REGISTRY"
"$(dirname "$0")/push.sh" "$ENV_NAME" "$IMAGE_TAG"

log "[3/5] copying compose file and env to $DEPLOY_HOST:$DEPLOY_DIR"
ssh_run "mkdir -p '$DEPLOY_DIR'"
scp_to_target "$DEPLOYMENT_DIR/$COMPOSE_FILE" "$ENV_FILE"

log "[4/5] starting services on $DEPLOY_HOST"
# --env-file is what makes ${REGISTRY} / ${WEB_PORT} interpolate in the compose
# file. `env_file:` inside the file only populates container environments, so
# without this the image name resolves to "/brainbook/app:tag" and the pull
# fails. IMAGE_TAG is passed in the shell environment, which outranks the file.
# --remove-orphans so a renamed service does not linger from an older release.
COMPOSE_CMD="docker compose --env-file '.env.$ENV_NAME' -f '$COMPOSE_FILE'"
ssh_run "cd '$DEPLOY_DIR' \
    && IMAGE_TAG='$IMAGE_TAG' $COMPOSE_CMD pull \
    && IMAGE_TAG='$IMAGE_TAG' $COMPOSE_CMD up -d --remove-orphans"

log "[5/5] waiting for health"
# Polled through the proxy, the same single origin a browser uses - no other
# service publishes a port.
for attempt in $(seq 1 36); do
    if ssh_run "curl -fsS http://localhost:$WEB_PORT/actuator/health" 2>/dev/null \
            | grep -q '"status":"UP"'; then
        log "deploy complete: $ENV_NAME is UP on tag $IMAGE_TAG (http://$DEPLOY_HOST:$WEB_PORT)"
        exit 0
    fi
    sleep 5
done

ssh_run "cd '$DEPLOY_DIR' && $COMPOSE_CMD ps; $COMPOSE_CMD logs --tail=40 app proxy" || true
die "service did not report healthy within 180s - check the logs above"
