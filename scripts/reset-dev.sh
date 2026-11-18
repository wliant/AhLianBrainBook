#!/usr/bin/env bash
# Return the dev environment to an empty database and bucket.
#
# The e2e suite cleans up after itself, but not reliably - a failed test can
# leave brains behind, and enough residue eventually breaks the tests that look
# things up in the sidebar. Run this before a run that needs a known starting
# state.
#
# dev only. This destroys data, so it checks the names it was given before
# touching anything and asks for confirmation.
#
# Usage: scripts/reset-dev.sh

source "$(dirname "$0")/lib/common.sh"
require_command ssh

load_env dev

# The env file is the only thing deciding which database is addressed, so a
# copy-paste of prod values into .env.dev would otherwise point this at
# production. Check the names themselves rather than trusting the filename.
[[ "$ENV_NAME" == "dev" ]] || die "refusing to run against '$ENV_NAME'"

APP_DB_CONTAINER="${APP_DB_CONTAINER:-postgres}"
MINIO_CONTAINER="${MINIO_CONTAINER:-minio}"
APP_DB_ADMIN="${APP_DB_ADMIN:-$SPRING_DATASOURCE_USERNAME}"

APP_DB_NAME="${SPRING_DATASOURCE_URL##*/}"
APP_DB_NAME="${APP_DB_NAME%%\?*}"

case "$APP_DB_NAME" in
    *_dev) ;;
    *) die "database '$APP_DB_NAME' is not named like a dev database - refusing" ;;
esac
case "$MINIO_BUCKET" in
    *-dev-*|*-dev) ;;
    *) die "bucket '$MINIO_BUCKET' is not named like a dev bucket - refusing" ;;
esac

warn "this empties database '$APP_DB_NAME' and bucket '$MINIO_BUCKET' on $DEPLOY_HOST"
confirm_or_abort "Type 'reset dev' to continue: " "reset dev"

COMPOSE_CMD="docker compose --env-file '.env.dev' -f '$COMPOSE_FILE'"

# Bring the app back on the tag it is already running, read off the container
# itself. Without this, `up` falls back to the env file's IMAGE_TAG - the
# compose-interpolation default, "latest" - which was never pushed, and the
# reset would leave dev down.
DEPLOYED_TAG="$(ssh_run "docker inspect --format '{{.Config.Image}}' brainbook-dev-app-1" 2>/dev/null | sed 's/.*://')"
[[ -n "$DEPLOYED_TAG" ]] || die "cannot read the running tag - is dev deployed? run scripts/deploy.sh dev first"
log "dev is running tag $DEPLOYED_TAG; it will come back on the same one"

log "[1/4] stopping the app so nothing holds a connection"
ssh_run "cd '$DEPLOY_DIR' && $COMPOSE_CMD stop app"

log "[2/4] recreating $APP_DB_NAME"
ssh_run "docker exec -i '$APP_DB_CONTAINER' psql -v ON_ERROR_STOP=1 -q -U '$APP_DB_ADMIN' -d postgres" <<SQL
DROP DATABASE IF EXISTS $APP_DB_NAME WITH (FORCE);
CREATE DATABASE $APP_DB_NAME OWNER $SPRING_DATASOURCE_USERNAME;
SQL
# Embeddings are pgvector columns and the migrations assume the extension.
ssh_run "docker exec -i '$APP_DB_CONTAINER' psql -v ON_ERROR_STOP=1 -q -U '$APP_DB_ADMIN' -d '$APP_DB_NAME'" <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
SQL

log "[3/4] emptying $MINIO_BUCKET"
ssh_run "docker exec '$MINIO_CONTAINER' sh -c '
    mc alias set reset http://localhost:9000 \"\$MINIO_ROOT_USER\" \"\$MINIO_ROOT_PASSWORD\" >/dev/null &&
    mc rm --recursive --force --quiet reset/$MINIO_BUCKET >/dev/null 2>&1;
    mc ls reset/$MINIO_BUCKET >/dev/null 2>&1 || mc mb reset/$MINIO_BUCKET'"

log "[4/4] starting the app - Flyway rebuilds the schema"
ssh_run "cd '$DEPLOY_DIR' && IMAGE_TAG='$DEPLOYED_TAG' $COMPOSE_CMD up -d app proxy"

for attempt in $(seq 1 36); do
    if ssh_run "curl -fsS http://localhost:$WEB_PORT/actuator/health" 2>/dev/null \
            | grep -q '"status":"UP"'; then
        log "dev reset: $APP_DB_NAME is empty and migrated"
        exit 0
    fi
    sleep 5
done
die "app did not come back healthy within 180s"
